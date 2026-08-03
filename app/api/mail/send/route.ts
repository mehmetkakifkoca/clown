import { NextResponse } from "next/server";
import { sendGraphMail } from "@/lib/microsoft-graph";
import { sendGmail } from "@/lib/google";
import { listMailAccounts } from "@/lib/firestore/mailAccounts";

export async function POST(request: Request) {
  try {
    const { to, subject, text, provider } = await request.json();
    const accounts = await listMailAccounts();

    // İstenen sağlayıcıya göre hesabı seç, yoksa ilk aktif hesabı al
    const targetAccount = provider
      ? accounts.find((a) => a.provider === provider) || accounts[0]
      : accounts[0];

    if (!targetAccount || !targetAccount.accessToken) {
      return NextResponse.json({ error: "E-posta göndermek için bağlı bir hesap yok." }, { status: 404 });
    }

    if (targetAccount.provider === "gmail") {
      await sendGmail(targetAccount.accessToken, to, subject, text);
    } else {
      await sendGraphMail(targetAccount.accessToken, to, subject, text);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "E-posta gönderimi başarısız.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
