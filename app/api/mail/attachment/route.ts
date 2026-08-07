import { NextResponse } from "next/server";
import { downloadImapAttachment } from "@/lib/imap/client";
import { downloadGmailAttachment, getValidGoogleAccessToken } from "@/lib/google";
import { downloadGraphAttachment, refreshAccessToken } from "@/lib/microsoft-graph";
import { listMailAccounts, saveMailAccount } from "@/lib/firestore/mailAccounts";

function contentDisposition(filename: string): string {
  const safe = filename.replace(/["\r\n]/g, "_");
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

// GET /api/mail/attachment?id=<provider::accountId::...>&filename=...&type=...
// Ek dosyayı ilgili sağlayıcıdan (IMAP/Gmail/Hotmail) indirip doğrudan istemciye akıtır.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") || "";
    const filenameParam = searchParams.get("filename") || "dosya";
    const typeParam = searchParams.get("type") || "application/octet-stream";

    const [provider, accountId, ...rest] = id.split("::");
    if (!provider || !accountId) {
      return NextResponse.json({ error: "Geçersiz ek kimliği" }, { status: 400 });
    }

    const accounts = await listMailAccounts();
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) {
      return NextResponse.json({ error: "Hesap bulunamadı" }, { status: 404 });
    }

    if (provider === "imap") {
      const [mailbox, uidStr, part] = rest;
      if (!acc.imapHost || !mailbox || !uidStr || !part) {
        return NextResponse.json({ error: "Ek bilgisi eksik" }, { status: 400 });
      }
      const { buffer, contentType, filename } = await downloadImapAttachment(
        { email: acc.email, appPassword: acc.appPassword || "", imapHost: acc.imapHost, imapPort: acc.imapPort },
        mailbox,
        Number(uidStr),
        part
      );
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": contentType || typeParam,
          "Content-Disposition": contentDisposition(filename || filenameParam),
        },
      });
    }

    if (provider === "gmail") {
      const [messageId, attachmentId] = rest;
      if (!acc.accessToken || !messageId || !attachmentId) {
        return NextResponse.json({ error: "Ek bilgisi eksik" }, { status: 400 });
      }
      const accessToken = await getValidGoogleAccessToken(acc);
      const buffer = await downloadGmailAttachment(accessToken, messageId, attachmentId);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": typeParam,
          "Content-Disposition": contentDisposition(filenameParam),
        },
      });
    }

    if (provider === "hotmail") {
      const [messageId, attachmentId] = rest;
      if (!acc.accessToken || !messageId || !attachmentId) {
        return NextResponse.json({ error: "Ek bilgisi eksik" }, { status: 400 });
      }
      let accessToken = acc.accessToken;
      if (acc.expiresAt && Date.now() > acc.expiresAt - 60000 && acc.refreshToken) {
        try {
          const newTokens = await refreshAccessToken(acc.refreshToken);
          accessToken = newTokens.access_token;
          await saveMailAccount(acc.id, acc.email, "", "hotmail", acc.label, newTokens.access_token, newTokens.refresh_token, Date.now() + newTokens.expires_in * 1000);
        } catch (e) {
          console.error("Microsoft token yenileme hatası:", e);
        }
      }
      const { buffer, contentType, filename } = await downloadGraphAttachment(accessToken, messageId, attachmentId);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": contentType || typeParam,
          "Content-Disposition": contentDisposition(filename || filenameParam),
        },
      });
    }

    return NextResponse.json({ error: "Bilinmeyen sağlayıcı" }, { status: 400 });
  } catch (err: unknown) {
    console.error("Ek indirme hatası:", err);
    const message = err instanceof Error ? err.message : "Ek indirilemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
