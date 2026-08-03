import { NextResponse } from "next/server";
import { fetchEmailById } from "@/lib/imap/outlook";
import { getDefaultMailAccount } from "@/lib/firestore/mailAccounts";

// GET /api/mail/[uid]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const creds = await getDefaultMailAccount();
    if (!creds) {
      return NextResponse.json({ error: "Bağlı hesap yok" }, { status: 404 });
    }

    const email = await fetchEmailById(creds, parseInt(uid));
    if (!email) {
      return NextResponse.json({ error: "E-posta bulunamadı" }, { status: 404 });
    }

    return NextResponse.json(email);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
