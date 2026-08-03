import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google";

// GET /api/auth/google -> Google Login Yönlendirmesi
export async function GET() {
  const url = getGoogleAuthUrl();
  return NextResponse.redirect(url);
}
