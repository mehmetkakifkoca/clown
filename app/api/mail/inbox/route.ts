import { NextResponse } from "next/server";
import { fetchGraphMessages, refreshAccessToken } from "@/lib/microsoft-graph";
import { fetchGmailMessages, getValidGoogleAccessToken } from "@/lib/google";
import { listMailAccounts, saveMailAccount } from "@/lib/firestore/mailAccounts";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";
    const accountFilter = searchParams.get("account") || "all"; // all | gmail | hotmail
    const folderFilter = searchParams.get("folder") || "inbox";  // inbox | sent | spam

    const accounts = await listMailAccounts();

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: "Bağlı e-posta hesabı bulunamadı." }, { status: 404 });
    }

    let allMessages: any[] = [];

    // Seçilen hesap ve klasöre göre filtrele
    const targetAccounts = accountFilter === "all"
      ? accounts.filter((a) => !a.isHidden && a.useForMail !== false)
      : accounts.filter((a) => a.provider === accountFilter && a.useForMail !== false);

    for (const acc of targetAccounts) {
      let accessToken = acc.accessToken;

      if (acc.provider === "hotmail" && acc.expiresAt && Date.now() > acc.expiresAt - 60000 && acc.refreshToken) {
        try {
          const newTokens = await refreshAccessToken(acc.refreshToken);
          accessToken = newTokens.access_token;
          await saveMailAccount(acc.id, acc.email, "", "hotmail", acc.label, newTokens.access_token, newTokens.refresh_token, Date.now() + newTokens.expires_in * 1000);
        } catch (e) { console.error("Microsoft token yenileme hatası:", e); }
      }

      if (acc.provider === "gmail") {
        try {
          accessToken = await getValidGoogleAccessToken(acc);
        } catch (e) { console.error("Google token yenileme hatası:", e); }
      }

      if (!accessToken) continue;

      if (acc.provider === "hotmail") {
        try {
          const folderPath = folderFilter === "sent" ? "sentitems" : folderFilter === "spam" ? "junkemail" : "inbox";
          const msgs = await fetchGraphMessages(accessToken, 20, folderPath);
          const formatted = msgs.map((msg: any) => ({
            id: msg.id,
            uid: msg.id,
            subject: msg.subject || "(Konu yok)",
            from: msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || "Bilinmiyor",
            fromEmail: msg.from?.emailAddress?.address || "",
            date: new Date(msg.receivedDateTime).toLocaleString("tr-TR"),
            rawDate: new Date(msg.receivedDateTime).getTime(),
            snippet: msg.bodyPreview || "",
            body: msg.body?.content || msg.bodyPreview || "",
            isRead: msg.isRead,
            hasAttachments: msg.hasAttachments,
            provider: "hotmail",
            accountEmail: acc.email,
          }));
          allMessages = allMessages.concat(formatted);
        } catch (e) { console.error("Microsoft mail hatası:", e); }
      }

      if (acc.provider === "gmail") {
        try {
          const gmailFolder = folderFilter === "sent" ? "SENT" : folderFilter === "spam" ? "SPAM" : "INBOX";
          const msgs = await fetchGmailMessages(accessToken, 20, gmailFolder);
          const formatted = msgs.map((msg: any) => ({
            ...msg,
            provider: "gmail",
            rawDate: msg.date ? new Date(msg.date).getTime() : Date.now(),
            accountEmail: acc.email,
          }));
          allMessages = allMessages.concat(formatted);
        } catch (e) { console.error("Gmail mail hatası:", e); }
      }
    }

    // Tarihe göre yeniden eskiye sırala
    allMessages.sort((a, b) => b.rawDate - a.rawDate);

    // Filtreleme
    if (filter === "unread") allMessages = allMessages.filter((m) => !m.isRead);
    if (filter === "attachments") allMessages = allMessages.filter((m) => m.hasAttachments);

    return NextResponse.json(allMessages);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
