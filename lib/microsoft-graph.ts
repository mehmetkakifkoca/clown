/**
 * lib/microsoft-graph.ts
 * Microsoft Graph API entegrasyonu (OAuth 2.0 Token & E-posta işlemleri)
 */

const CLIENT_ID = process.env.OUTLOOK_CLIENT_ID || "";
const CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET || "";
const REDIRECT_URI = "https://clown-seven.vercel.app/api/auth/callback/microsoft";

const SCOPES = ["openid", "profile", "offline_access", "User.Read", "Mail.Read", "Mail.Send"].join(" ");

// 1. Microsoft Login URL Üretme
export function getMicrosoftAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    response_mode: "query",
    scope: SCOPES,
  });
  return `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params.toString()}`;
}

// 2. OAuth Code -> Access Token & Refresh Token Takası
export async function getTokensFromCode(code: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Token alımı başarısız: ${errorText}`);
  }

  return res.json();
}

// 3. Refresh Token ile Access Token Yenileme
export async function refreshAccessToken(refreshToken: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: SCOPES,
  });

  const res = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    throw new Error("Access token yenilenemedi.");
  }

  return res.json();
}

// 4. Microsoft Graph API: Klasöre Göre Mesajları Çekme
export async function fetchGraphMessages(accessToken: string, limit = 20, folderPath = "inbox") {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/${folderPath}/messages?$top=${limit}&$select=id,subject,bodyPreview,from,toRecipients,receivedDateTime,isRead,hasAttachments,body`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("Microsoft Graph API üzerinden mesajlar çekilemedi.");
  }

  const data = await res.json();
  return data.value || [];
}

// 4b. Microsoft Graph API: Mesajın Eklerini Listeleme
export interface GraphAttachmentInfo {
  id: string;
  name: string;
  contentType: string;
  size: number;
}

export async function fetchGraphAttachments(accessToken: string, messageId: string): Promise<GraphAttachmentInfo[]> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    console.error("Outlook ekleri listelenemedi:", res.status, await res.text());
    return [];
  }

  const data = await res.json();
  return (data.value || [])
    .filter((a: any) => a["@odata.type"] === "#microsoft.graph.fileAttachment")
    .map((a: any) => ({ id: a.id, name: a.name, contentType: a.contentType, size: a.size }));
}

// 4c. Microsoft Graph API: Ek Dosyayı İndirme
export async function downloadGraphAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("Outlook eki indirilemedi.");
  }

  const data = await res.json();
  return {
    buffer: Buffer.from(data.contentBytes || "", "base64"),
    contentType: data.contentType || "application/octet-stream",
    filename: data.name || "dosya",
  };
}

// 5. Microsoft Graph API: E-posta Gönderme
export async function sendGraphMail(accessToken: string, toEmail: string, subject: string, content: string) {
  const message = {
    message: {
      subject,
      body: {
        contentType: "Text",
        content,
      },
      toRecipients: [
        {
          emailAddress: {
            address: toEmail,
          },
        },
      ],
    },
  };

  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`E-posta gönderilemedi: ${err}`);
  }

  return true;
}
