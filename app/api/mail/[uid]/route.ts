import { NextResponse } from "next/server";
import { fetchGraphMessages } from "@/lib/microsoft-graph";
import { listMailAccounts } from "@/lib/firestore/mailAccounts";

// GET /api/mail/[uid]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
    const accounts = await listMailAccounts();
    const activeAccount = accounts[0];

    if (!activeAccount || !activeAccount.accessToken) {
      return NextResponse.json({ error: "Bağlı hesap yok" }, { status: 404 });
    }

    const messages = await fetchGraphMessages(activeAccount.accessToken, 50);
    const target = messages.find((m: any) => m.id === uid);

    if (!target) {
      return NextResponse.json({ error: "E-posta bulunamadı" }, { status: 404 });
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
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
