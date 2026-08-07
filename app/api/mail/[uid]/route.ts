import { NextResponse } from "next/server";
import { fetchGraphMessages, fetchGraphAttachments } from "@/lib/microsoft-graph";
import { fetchGmailMessages, getValidGoogleAccessToken } from "@/lib/google";
import { fetchImapMessageById } from "@/lib/imap/client";
import { listMailAccounts } from "@/lib/firestore/mailAccounts";

function attachmentDownloadUrl(id: string, filename: string, contentType: string): string {
  const params = new URLSearchParams({ id, filename: filename || "dosya", type: contentType || "application/octet-stream" });
  return `/api/mail/attachment?${params.toString()}`;
}

// GET /api/mail/[uid] -> Mesaj detayını Gmail, Hotmail ve IMAP için çek
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const accounts = await listMailAccounts();

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: "Bağlı hesap yok" }, { status: 404 });
    }

    // IMAP mesajları hesap+klasör+uid bilgisini id içinde taşır: imap::{accountId}::{mailbox}::{uid}
    if (uid.startsWith("imap::")) {
      const [, accountId, mailbox, uidStr] = uid.split("::");
      const acc = accounts.find((a) => a.id === accountId);
      if (!acc || !acc.imapHost) {
        return NextResponse.json({ error: "IMAP hesabı bulunamadı" }, { status: 404 });
      }
      try {
        const msg = await fetchImapMessageById(
          {
            email: acc.email,
            appPassword: acc.appPassword || "",
            imapHost: acc.imapHost,
            imapPort: acc.imapPort,
          },
          mailbox,
          Number(uidStr)
        );
        if (!msg) {
          return NextResponse.json({ error: "E-posta bulunamadı" }, { status: 404 });
        }
        return NextResponse.json({
          id: uid,
          accountId: acc.id,
          subject: msg.subject,
          from: msg.from,
          fromEmail: msg.fromEmail,
          to: msg.to,
          date: msg.date,
          snippet: msg.snippet,
          body: msg.body,
          isRead: msg.isRead,
          hasAttachments: msg.hasAttachments,
          provider: "imap",
          attachments: (msg.attachments || []).map((a) => ({
            filename: a.filename || "dosya",
            contentType: a.contentType,
            size: a.size,
            downloadUrl: attachmentDownloadUrl(`imap::${acc.id}::${mailbox}::${uidStr}::${a.part}`, a.filename || "dosya", a.contentType),
          })),
        });
      } catch (e) {
        console.error("IMAP mesaj detay hatası:", e);
        const message = e instanceof Error ? e.message : "IMAP bağlantı hatası";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    // Önce Hotmail hesabını kontrol et
    const hotmailAcc = accounts.find((a) => a.provider === "hotmail");
    if (hotmailAcc && hotmailAcc.accessToken) {
      try {
        const msgs = await fetchGraphMessages(hotmailAcc.accessToken, 50);
        const target = msgs.find((m: any) => m.id === uid);
        if (target) {
          let attachments: any[] = [];
          if (target.hasAttachments) {
            const graphAttachments = await fetchGraphAttachments(hotmailAcc.accessToken, target.id);
            attachments = graphAttachments.map((a) => ({
              filename: a.name || "dosya",
              contentType: a.contentType,
              size: a.size,
              downloadUrl: attachmentDownloadUrl(`hotmail::${hotmailAcc.id}::${target.id}::${a.id}`, a.name || "dosya", a.contentType),
            }));
          }
          return NextResponse.json({
            id: target.id,
            uid: target.id,
            subject: target.subject || "(Konu yok)",
            from: target.from?.emailAddress?.name || target.from?.emailAddress?.address || "Bilinmiyor",
            fromEmail: target.from?.emailAddress?.address || "",
            to: target.toRecipients?.[0]?.emailAddress?.address || "",
            date: new Date(target.receivedDateTime).toLocaleString("tr-TR"),
            snippet: target.bodyPreview || "",
            body: target.body?.content || target.bodyPreview || "",
            isRead: target.isRead,
            hasAttachments: target.hasAttachments,
            provider: "hotmail",
            attachments,
          });
        }
      } catch (e) {
        console.error("Hotmail mesaj detayı çekilemedi:", e);
      }
    }

    // Gmail hesabını kontrol et
    const gmailAcc = accounts.find((a) => a.provider === "gmail");
    if (gmailAcc && gmailAcc.accessToken) {
      try {
        const accessToken = await getValidGoogleAccessToken(gmailAcc);
        const msgs = await fetchGmailMessages(accessToken, 50);
        const target = msgs.find((m: any) => m.id === uid);
        if (target) {
          const attachments = (target.attachments || []).map((a: any) => ({
            filename: a.filename || "dosya",
            contentType: a.contentType,
            size: a.size,
            downloadUrl: attachmentDownloadUrl(`gmail::${gmailAcc.id}::${target.id}::${a.attachmentId}`, a.filename || "dosya", a.contentType),
          }));
          return NextResponse.json({
            ...target,
            to: gmailAcc.email,
            attachments,
          });
        }
      } catch (e) {
        console.error("Gmail mesaj detayı çekilemedi:", e);
      }
    }

    return NextResponse.json({ error: "E-posta bulunamadı" }, { status: 404 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
