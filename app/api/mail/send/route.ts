import { NextResponse } from "next/server";
import { sendEmail, replyToEmail } from "@/lib/imap/outlook";
import { getDefaultMailAccount } from "@/lib/firestore/mailAccounts";

// POST /api/mail/send
// Body: { to, subject, text } | { replyTo, replySubject, text }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const creds = await getDefaultMailAccount();

    if (!creds) {
      return NextResponse.json({ error: "Bağlı hesap yok" }, { status: 404 });
    }

    if (body.replyTo) {
      // Yanıt gönder
      await replyToEmail(creds, body.replyTo, body.replySubject ?? "", body.text);
    } else {
      // Yeni e-posta gönder
      await sendEmail(creds, body.to, body.subject, body.text);
    }

    return NextResponse.json({ success: true, message: "E-posta gönderildi" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("SMTP hatası:", message);
    return NextResponse.json({ error: `Gönderme hatası: ${message}` }, { status: 500 });
  }
}
