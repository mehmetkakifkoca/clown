import { NextResponse } from "next/server";
import { fetchGoogleCalendarEvents } from "@/lib/google";
import { listMailAccounts } from "@/lib/firestore/mailAccounts";

// GET /api/calendar/events -> Canlı Google Calendar Etkinlikleri
export async function GET() {
  try {
    const accounts = await listMailAccounts();
    const googleAcc = accounts.find((a) => a.provider === "gmail");

    if (!googleAcc || !googleAcc.accessToken) {
      return NextResponse.json([]);
    }

    const events = await fetchGoogleCalendarEvents(googleAcc.accessToken);
    return NextResponse.json(events);
  } catch (err: any) {
    console.error("Google Calendar çekilemedi:", err);
    return NextResponse.json([]);
  }
}
