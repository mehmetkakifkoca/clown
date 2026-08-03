import { NextResponse } from "next/server";
import { fetchGraphMessages, refreshAccessToken } from "@/lib/microsoft-graph";
import { fetchGmailMessages, refreshGoogleAccessToken } from "@/lib/google";
import { listMailAccounts, saveMailAccount } from "@/lib/firestore/mailAccounts";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";

    const accounts = await listMailAccounts();

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: "Bağlı e-posta hesabı bulunamadı." }, { status: 404 });
    }

    let allMessages: any[] = [];

    // Tüm bağlı hesaplardan (Hotmail / Gmail) mesajları çek ve birleştir (Unified Inbox)
    for (const acc of accounts) {
      let accessToken = acc.accessToken;

      // Microsoft Token Yenileme
      if (acc.provider === "hotmail" && acc.expiresAt && Date.now() > acc.expiresAt - 60000 && acc.refreshToken) {
        try {
          const newTokens = await refreshAccessToken(acc.refreshToken);
          accessToken = newTokens.access_token;
          await saveMailAccount(acc.id, acc.email, "", "hotmail", acc.label, newTokens.access_token, newTokens.refresh_token, Date.now() + newTokens.expires_in * 1000);
        } catch (e) { console.error("Microsoft token yenileme hatası:", e); }
      }

      // Google Token Yenileme
      if (acc.provider === "gmail" && acc.expiresAt && Date.now() > acc.expiresAt - 60000 && acc.refreshToken) {
        try {
          const newTokens = await refreshGoogleAccessToken(acc.refreshToken);
          accessToken = newTokens.access_token;
          await saveMailAccount(acc.id, acc.email, "", "gmail", acc.label, newTokens.access_token, acc.refreshToken, Date.now() + newTokens.expires_in * 1000);
        } catch (e) { console.error("Google token yenileme hatası:", e); }
      }

      if (!accessToken) continue;

      if (acc.provider === "hotmail") {
        try {
          const msgs = await fetchGraphMessages(accessToken, 20);
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
          }));
          allMessages = allMessages.concat(formatted);
        } catch (e) { console.error("Microsoft mail hatası:", e); }
      }

      if (acc.provider === "gmail") {
        try {
          const msgs = await fetchGmailMessages(accessToken, 20);
          const formatted = msgs.map((msg: any) => ({
            ...msg,
            rawDate: msg.date ? new Date(msg.date).getTime() : Date.now(),
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
