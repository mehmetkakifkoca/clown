import { NextResponse } from "next/server";
import { getGoogleTokensFromCode } from "@/lib/google";
import { setDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// GET /api/auth/callback/google -> Google OAuth Callback
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  if (error || !code) {
    const errDetail = encodeURIComponent(`${error || "no_code"}: ${errorDesc || ""}`);
    return NextResponse.redirect(new URL(`/settings/accounts?error=google_auth_failed&details=${errDetail}`, request.url));
  }

  try {
    const tokens = await getGoogleTokensFromCode(code);

    // Kullanıcı profil bilgisini çek
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userData = await userRes.json();

    const email = userData.email;
    const accountId = `gmail_${email.replace(/[@.]/g, "_")}`;

    // Firestore'a kaydet
    await setDoc(doc(db, "mailAccounts", accountId), {
      email,
      provider: "gmail",
      label: "Google / Gmail (OAuth)",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.redirect(new URL("/inbox?success=google_connected", request.url));
  } catch (err: any) {
    console.error("Google OAuth Callback Hatası:", err);
    const errMsg = encodeURIComponent(err?.message || "unknown_error");
    return NextResponse.redirect(new URL(`/settings/accounts?error=google_token_failed&details=${errMsg}`, request.url));
  }
}
