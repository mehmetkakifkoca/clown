import { NextResponse } from "next/server";
import { fetchInboxEmails } from "@/lib/imap/outlook";
import { getDefaultMailAccount } from "@/lib/firestore/mailAccounts";

// GET /api/mail/inbox?filter=all|unread|flagged
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") ?? "all";

    const creds = await getDefaultMailAccount();
    if (!creds) {
      return NextResponse.json(
        { error: "Bağlı posta hesabı yok. Ayarlar > Bağlı Hesaplar bölümünden ekleyin." },
        { status: 404 }
      );
    }

    let emails = await fetchInboxEmails(creds, 30);

    if (filter === "unread") emails = emails.filter((e) => !e.isRead);
    if (filter === "flagged") emails = emails.filter((e) => e.flags.has("\\Flagged"));
    if (filter === "attachments") emails = emails.filter((e) => e.hasAttachments);

    return NextResponse.json(emails);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("IMAP hatası:", message);
    return NextResponse.json({ error: `IMAP bağlantı hatası: ${message}` }, { status: 500 });
  }
}
