import { NextResponse } from "next/server";
import {
  fetchGoogleCalendarEvents,
  fetchGoogleCalendarList,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getValidGoogleAccessToken,
} from "@/lib/google";
import { listMailAccounts } from "@/lib/firestore/mailAccounts";

async function getGoogleAccessToken(): Promise<string | null> {
  const accounts = await listMailAccounts();
  const googleAcc = accounts.find((a) => a.provider === "gmail");
  if (!googleAcc || !googleAcc.accessToken) return null;
  return getValidGoogleAccessToken(googleAcc);
}

// GET /api/calendar/events?days=30 -> Tüm Takvimlerden Canlı Etkinlikler
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("days")) || 30;

    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      return NextResponse.json({ events: [], calendars: [] });
    }

    const [events, calendars] = await Promise.all([
      fetchGoogleCalendarEvents(accessToken, days),
      fetchGoogleCalendarList(accessToken),
    ]);

    return NextResponse.json({ events, calendars });
  } catch (err: any) {
    console.error("Google Calendar çekilemedi:", err);
    return NextResponse.json({ events: [], calendars: [] });
  }
}

// POST /api/calendar/events -> Yeni Etkinlik Oluştur
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { calendarId, title, start, end, description, location, allDay, timeZone } = body;

    if (!calendarId || !title || !start || !end) {
      return NextResponse.json({ error: "calendarId, title, start ve end alanları zorunludur." }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Google hesabı bağlı değil." }, { status: 404 });
    }

    const event = await createGoogleCalendarEvent(accessToken, calendarId, {
      title,
      description,
      location,
      start,
      end,
      allDay,
      timeZone,
    });

    return NextResponse.json(event);
  } catch (err: any) {
    console.error("Etkinlik oluşturulamadı:", err);
    return NextResponse.json({ error: err?.message || "Etkinlik oluşturulamadı." }, { status: 500 });
  }
}

// PATCH /api/calendar/events -> Etkinliği Güncelle
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { calendarId, eventId, ...updates } = body;

    if (!calendarId || !eventId) {
      return NextResponse.json({ error: "calendarId ve eventId alanları zorunludur." }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Google hesabı bağlı değil." }, { status: 404 });
    }

    const event = await updateGoogleCalendarEvent(accessToken, calendarId, eventId, updates);
    return NextResponse.json(event);
  } catch (err: any) {
    console.error("Etkinlik güncellenemedi:", err);
    return NextResponse.json({ error: err?.message || "Etkinlik güncellenemedi." }, { status: 500 });
  }
}

// DELETE /api/calendar/events?calendarId=...&eventId=... -> Etkinliği Sil
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get("calendarId");
    const eventId = searchParams.get("eventId");

    if (!calendarId || !eventId) {
      return NextResponse.json({ error: "calendarId ve eventId parametreleri zorunludur." }, { status: 400 });
    }

    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Google hesabı bağlı değil." }, { status: 404 });
    }

    await deleteGoogleCalendarEvent(accessToken, calendarId, eventId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Etkinlik silinemedi:", err);
    return NextResponse.json({ error: err?.message || "Etkinlik silinemedi." }, { status: 500 });
  }
}
