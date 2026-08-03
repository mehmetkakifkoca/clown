import { NextResponse } from "next/server";
import { getTokensFromCode } from "@/lib/microsoft-graph";
import { setDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// GET /api/auth/callback/microsoft -> Microsoft Callback İşleme & Token Saklama
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  if (error || !code) {
    const errDetail = encodeURIComponent(`${error || "no_code"}: ${errorDesc || ""}`);
    return NextResponse.redirect(new URL(`/settings/accounts?error=auth_failed&details=${errDetail}`, request.url));
  }

  try {
    const tokens = await getTokensFromCode(code);

    // Kullanıcı profil bilgisini çek
    const userRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userData = await userRes.json();

    const email = userData.mail || userData.userPrincipalName;
    const accountId = `microsoft_${email.replace(/[@.]/g, "_")}`;

    // Token ve hesap bilgisini Firestore'a kaydet
    await setDoc(doc(db, "mailAccounts", accountId), {
      email,
      provider: "hotmail",
      label: "Hotmail / Outlook (OAuth)",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.redirect(new URL("/inbox?success=connected", request.url));
  } catch (err: any) {
    console.error("Microsoft OAuth Callback Hatası:", err);
    const errMsg = encodeURIComponent(err?.message || "unknown_error");
    return NextResponse.redirect(new URL(`/settings/accounts?error=token_exchange_failed&details=${errMsg}`, request.url));
  }
}
