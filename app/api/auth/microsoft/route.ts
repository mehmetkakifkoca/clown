import { NextResponse } from "next/server";
import { getMicrosoftAuthUrl } from "@/lib/microsoft-graph";

// GET /api/auth/microsoft -> Microsoft Giriş Sayfasına Yönlendirir
export async function GET() {
  const url = getMicrosoftAuthUrl();
  return NextResponse.redirect(url);
}
