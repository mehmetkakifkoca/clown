/**
 * lib/google.ts
 * Google OAuth 2.0, Gmail API & Google Calendar API Entegrasyonu
 */
import { saveMailAccount, type StoredMailAccount } from "@/lib/firestore/mailAccounts";

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
    prompt: "select_account consent",
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

// 3b. Geçerli Access Token'ı Getir (Gerekirse Otomatik Yenile)
export async function getValidGoogleAccessToken(account: StoredMailAccount): Promise<string> {
  if (!account.accessToken) {
    throw new Error("Google hesabı için erişim tokenı bulunamadı.");
  }

  const isExpired = account.expiresAt ? Date.now() > account.expiresAt - 60000 : false;
  if (!isExpired || !account.refreshToken) {
    return account.accessToken;
  }

  const newTokens = await refreshGoogleAccessToken(account.refreshToken);
  const newAccessToken = newTokens.access_token as string;
  const newExpiresAt = Date.now() + newTokens.expires_in * 1000;

  await saveMailAccount(
    account.id,
    account.email,
    "",
    "gmail",
    account.label,
    newAccessToken,
    account.refreshToken,
    newExpiresAt
  );

  account.accessToken = newAccessToken;
  account.expiresAt = newExpiresAt;

  return newAccessToken;
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

// 6. Google Calendar API: Kullanıcının Tüm Takvimlerini Çekme
export interface GoogleCalendarInfo {
  id: string;
  name: string;
  color: string;
  primary: boolean;
}

export async function fetchGoogleCalendarList(accessToken: string): Promise<GoogleCalendarInfo[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Takvim listesi çekilemedi (${res.status}): ${errText}`);
  }
  const data = await res.json();

  return (data.items || [])
    .filter((cal: any) => cal.selected !== false)
    .map((cal: any) => ({
      id: cal.id,
      name: cal.summaryOverride || cal.summary || cal.id,
      color: cal.backgroundColor || "#4285F4",
      primary: Boolean(cal.primary),
    }));
}

// 7. Google Calendar API: Tüm Takvimlerden Etkinlikleri Çekme
export async function fetchGoogleCalendarEvents(accessToken: string, days = 30) {
  const calendars = await fetchGoogleCalendarList(accessToken);
  if (calendars.length === 0) return [];

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const eventLists = await Promise.all(
    calendars.map(async (cal) => {
      try {
        const params = new URLSearchParams({
          timeMin,
          timeMax,
          orderBy: "startTime",
          singleEvents: "true",
          maxResults: "50",
        });
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params.toString()}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) return [];
        const data = await res.json();

        return (data.items || []).map((item: any) => ({
          id: item.id,
          title: item.summary || "Başlıksız Etkinlik",
          description: item.description || "",
          date: item.start?.dateTime ? item.start.dateTime.split("T")[0] : item.start?.date,
          startTime: item.start?.dateTime ? item.start.dateTime.split("T")[1].slice(0, 5) : "Tüm Gün",
          endTime: item.end?.dateTime ? item.end.dateTime.split("T")[1].slice(0, 5) : "Tüm Gün",
          startDateTime: item.start?.dateTime || item.start?.date,
          endDateTime: item.end?.dateTime || item.end?.date,
          location: item.location || "",
          category: "Google Calendar",
          isUrgent: false,
          provider: "Google",
          calendarId: cal.id,
          calendarName: cal.name,
          calendarColor: cal.color,
        }));
      } catch {
        return [];
      }
    })
  );

  return eventLists.flat().sort((a, b) => {
    const aTime = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
    const bTime = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
    return aTime - bTime;
  });
}

// 8. Google Calendar API: Yeni Etkinlik Oluşturma
interface GoogleCalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay?: boolean;
  timeZone?: string;
}

function buildGoogleEventBody(event: Partial<GoogleCalendarEventInput>) {
  const body: any = {};
  if (event.title !== undefined) body.summary = event.title;
  if (event.description !== undefined) body.description = event.description;
  if (event.location !== undefined) body.location = event.location;

  if (event.start !== undefined) {
    body.start = event.allDay
      ? { date: event.start }
      : { dateTime: event.start, timeZone: event.timeZone || "UTC" };
  }
  if (event.end !== undefined) {
    body.end = event.allDay
      ? { date: event.end }
      : { dateTime: event.end, timeZone: event.timeZone || "UTC" };
  }

  return body;
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleCalendarEventInput
) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildGoogleEventBody(event)),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Etkinlik oluşturulamadı: ${errText}`);
  }

  return res.json();
}

// 9. Google Calendar API: Etkinlik Güncelleme
export async function updateGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  updates: Partial<GoogleCalendarEventInput>
) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildGoogleEventBody(updates)),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Etkinlik güncellenemedi: ${errText}`);
  }

  return res.json();
}

// 10. Google Calendar API: Etkinlik Silme
export async function deleteGoogleCalendarEvent(accessToken: string, calendarId: string, eventId: string) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok && res.status !== 410) {
    const errText = await res.text();
    throw new Error(`Etkinlik silinemedi: ${errText}`);
  }

  return true;
}
