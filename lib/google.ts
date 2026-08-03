/**
 * lib/google.ts
 * Google OAuth 2.0, Gmail API & Google Calendar API Entegrasyonu
 */

const CLIENT_ID = process.env.GMAIL_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || "";
const REDIRECT_URI = "https://clown-seven.vercel.app/api/auth/callback/google";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

// 1. Google Login URL Üretme
export function getGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// 2. Code -> Token Takası
export async function getGoogleTokensFromCode(code: string) {
  const params = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google token değişimi başarısız: ${errText}`);
  }

  return res.json();
}

// 3. Refresh Token ile Access Token Yenileme
export async function refreshGoogleAccessToken(refreshToken: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    throw new Error("Google access token yenilenemedi.");
  }

  return res.json();
}

function decodeBase64Url(base64UrlStr: string) {
  if (!base64UrlStr) return "";
  let base64 = base64UrlStr.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  try {
    return decodeURIComponent(
      escape(typeof window !== "undefined" ? window.atob(base64) : Buffer.from(base64, "base64").toString("binary"))
    );
  } catch {
    return Buffer.from(base64, "base64").toString("utf-8");
  }
}

function parseGmailBody(payload: any): string {
  if (!payload) return "";
  if (payload.body && payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts && payload.parts.length > 0) {
    // Önce html ara, yoksa text/plain
    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (htmlPart && htmlPart.body && htmlPart.body.data) {
      return decodeBase64Url(htmlPart.body.data);
    }
    const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (textPart && textPart.body && textPart.body.data) {
      return decodeBase64Url(textPart.body.data);
    }
    // Özyinelemeli parçaları tara
    for (const part of payload.parts) {
      const res = parseGmailBody(part);
      if (res) return res;
    }
  }
  return "";
}

// 4. Gmail API: Mesajları Çekme
export async function fetchGmailMessages(accessToken: string, limit = 20, folder = "INBOX") {
  const labelParam = folder === "SENT" ? "SENT" : folder === "SPAM" ? "SPAM" : "INBOX";
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}&q=label:${labelParam}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    throw new Error("Gmail mesajları çekilemedi.");
  }

  const listData = await listRes.json();
  if (!listData.messages || listData.messages.length === 0) return [];

  const detailPromises = listData.messages.map(async (item: { id: string }) => {
    const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return detailRes.json();
  });

  const rawMessages = await Promise.all(detailPromises);

  return rawMessages.map((msg: any) => {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    const subject = getHeader("Subject") || "(Konu yok)";
    const from = getHeader("From");
    const date = getHeader("Date");

    const snippet = msg.snippet || "";
    const body = parseGmailBody(msg.payload) || snippet;

    return {
      id: msg.id,
      uid: msg.id,
      subject,
      from: from.split("<")[0].trim() || from,
      fromEmail: from.includes("<") ? from.split("<")[1].replace(">", "").trim() : from,
      date: date ? new Date(date).toLocaleString("tr-TR") : "",
      snippet,
      body,
      isRead: !msg.labelIds?.includes("UNREAD"),
      hasAttachments: Boolean(msg.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0)),
      provider: "gmail",
    };
  });
}

// 5. Gmail API: E-posta Gönderme
export async function sendGmail(accessToken: string, toEmail: string, subject: string, content: string) {
  const rawMessage = [
    `To: ${toEmail}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "",
    content,
  ].join("\r\n");

  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail gönderilemedi: ${err}`);
  }

  return true;
}

// 6. Google Calendar API: Canlı Etkinlikleri Çekme
export async function fetchGoogleCalendarEvents(accessToken: string) {
  const now = new Date().toISOString();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&orderBy=startTime&singleEvents=true&maxResults=25`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) return [];
  const data = await res.json();

  return (data.items || []).map((item: any) => ({
    id: item.id,
    title: item.summary || "Başlıksız Etkinlik",
    date: item.start?.dateTime ? item.start.dateTime.split("T")[0] : item.start?.date,
    startTime: item.start?.dateTime ? item.start.dateTime.split("T")[1].slice(0, 5) : "Tüm Gün",
    endTime: item.end?.dateTime ? item.end.dateTime.split("T")[1].slice(0, 5) : "Tüm Gün",
    location: item.location || "",
    category: "Google Calendar",
    isUrgent: false,
    provider: "Google",
  }));
}
