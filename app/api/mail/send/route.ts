import { NextResponse } from "next/server";
import { sendGraphMail } from "@/lib/microsoft-graph";
import { listMailAccounts } from "@/lib/firestore/mailAccounts";

export async function POST(request: Request) {
  try {
    const { to, subject, text } = await request.json();
    const accounts = await listMailAccounts();
    const activeAccount = accounts[0];

    if (!activeAccount || !activeAccount.accessToken) {
      return NextResponse.json({ error: "E-posta göndermek için bağlı bir hesap yok." }, { status: 404 });
    }

    await sendGraphMail(activeAccount.accessToken, to, subject, text);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "E-posta gönderimi başarısız.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
