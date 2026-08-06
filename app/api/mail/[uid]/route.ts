import { NextResponse } from "next/server";
import { fetchGraphMessages } from "@/lib/microsoft-graph";
import { fetchGmailMessages, getValidGoogleAccessToken } from "@/lib/google";
import { listMailAccounts } from "@/lib/firestore/mailAccounts";

// GET /api/mail/[uid] -> Mesaj detayını hem Gmail hem Hotmail için çek
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

    // Önce Hotmail hesabını kontrol et
    const hotmailAcc = accounts.find((a) => a.provider === "hotmail");
    if (hotmailAcc && hotmailAcc.accessToken) {
      try {
        const msgs = await fetchGraphMessages(hotmailAcc.accessToken, 50);
        const target = msgs.find((m: any) => m.id === uid);
        if (target) {
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
          return NextResponse.json({
            ...target,
            to: gmailAcc.email,
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
