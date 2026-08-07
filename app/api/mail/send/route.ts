import { NextResponse } from "next/server";
import { sendGraphMail } from "@/lib/microsoft-graph";
import { sendGmail, getValidGoogleAccessToken } from "@/lib/google";
import { sendImapMail } from "@/lib/imap/client";
import { listMailAccounts } from "@/lib/firestore/mailAccounts";

export async function POST(request: Request) {
  try {
    const { to, subject, text, provider, accountId } = await request.json();
    const accounts = await listMailAccounts();

    // Yanıtlarda doğru hesaptan gönderebilmek için önce accountId'ye bak,
    // yoksa sağlayıcıya göre, o da yoksa ilk aktif hesabı al
    const targetAccount = accountId
      ? accounts.find((a) => a.id === accountId)
      : provider
      ? accounts.find((a) => a.provider === provider) || accounts[0]
      : accounts[0];

    if (!targetAccount) {
      return NextResponse.json({ error: "E-posta göndermek için bağlı bir hesap yok." }, { status: 404 });
    }

    if (targetAccount.provider === "imap") {
      if (!targetAccount.imapHost) {
        return NextResponse.json({ error: "IMAP hesabının sunucu bilgileri eksik." }, { status: 400 });
      }
      await sendImapMail(
        {
          email: targetAccount.email,
          appPassword: targetAccount.appPassword || "",
          imapHost: targetAccount.imapHost,
          smtpHost: targetAccount.smtpHost || targetAccount.imapHost,
          smtpPort: targetAccount.smtpPort,
        },
        to,
        subject,
        text
      );
    } else if (targetAccount.provider === "gmail") {
      if (!targetAccount.accessToken) {
        return NextResponse.json({ error: "E-posta göndermek için bağlı bir hesap yok." }, { status: 404 });
      }
      const accessToken = await getValidGoogleAccessToken(targetAccount);
      await sendGmail(accessToken, to, subject, text);
    } else {
      if (!targetAccount.accessToken) {
        return NextResponse.json({ error: "E-posta göndermek için bağlı bir hesap yok." }, { status: 404 });
      }
      await sendGraphMail(targetAccount.accessToken, to, subject, text);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "E-posta gönderimi başarısız.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
