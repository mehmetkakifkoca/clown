import { NextResponse } from "next/server";
import { fetchGraphMessages, refreshAccessToken } from "@/lib/microsoft-graph";
import { listMailAccounts, saveMailAccount } from "@/lib/firestore/mailAccounts";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";

    const accounts = await listMailAccounts();
    const activeAccount = accounts[0];

    if (!activeAccount) {
      return NextResponse.json({ error: "Bağlı e-posta hesabı bulunamadı." }, { status: 404 });
    }

    // Token Süresi Dolmuşsa Refresh Et
    let accessToken = activeAccount.accessToken;
    if (activeAccount.expiresAt && Date.now() > activeAccount.expiresAt - 60000 && activeAccount.refreshToken) {
      try {
        const newTokens = await refreshAccessToken(activeAccount.refreshToken);
        accessToken = newTokens.access_token;

        await saveMailAccount(
          activeAccount.id,
          activeAccount.email,
          "",
          "hotmail",
          activeAccount.label,
          newTokens.access_token,
          newTokens.refresh_token,
          Date.now() + newTokens.expires_in * 1000
        );
      } catch (e) {
        console.error("Token yenileme hatası:", e);
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: "E-posta erişim yetkisi geçersiz. Lütfen hesabınızı tekrar bağlayın." }, { status: 401 });
    }

    const graphMessages = await fetchGraphMessages(accessToken, 30);

    const formattedMessages = graphMessages.map((msg: any) => ({
      id: msg.id,
      uid: msg.id,
      subject: msg.subject || "(Konu yok)",
      from: msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || "Bilinmiyor",
      fromEmail: msg.from?.emailAddress?.address || "",
      date: new Date(msg.receivedDateTime).toLocaleString("tr-TR"),
      snippet: msg.bodyPreview || "",
      body: msg.body?.content || msg.bodyPreview || "",
      isRead: msg.isRead,
      hasAttachments: msg.hasAttachments,
    }));

    return NextResponse.json(formattedMessages);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
