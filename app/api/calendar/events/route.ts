import { NextResponse } from "next/server";
import {
  fetchGoogleCalendarEvents,
  fetchGoogleCalendarList,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getValidGoogleAccessToken,
} from "@/lib/google";
import { listMailAccounts, type StoredMailAccount } from "@/lib/firestore/mailAccounts";

async function getGoogleAccounts(): Promise<StoredMailAccount[]> {
  const accounts = await listMailAccounts();
  return accounts.filter((a) => a.provider === "gmail" && a.accessToken);
}

async function getAccessTokenForAccount(accountEmail: string): Promise<string | null> {
  const accounts = await getGoogleAccounts();
  const acc = accounts.find((a) => a.email === accountEmail);
  if (!acc) return null;
  return getValidGoogleAccessToken(acc);
}

// GET /api/calendar/events?days=30 -> Bağlı Tüm Google Hesaplarından Canlı Etkinlikler
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("days")) || 30;

    const accounts = await getGoogleAccounts();
    if (accounts.length === 0) {
      return NextResponse.json({ events: [], calendars: [] });
    }

    const results = await Promise.all(
      accounts.map(async (acc) => {
        try {
          const accessToken = await getValidGoogleAccessToken(acc);
          const [events, calendars] = await Promise.all([
            fetchGoogleCalendarEvents(accessToken, days),
            fetchGoogleCalendarList(accessToken),
          ]);
          return {
            events: events.map((e: any) => ({ ...e, accountEmail: acc.email })),
            calendars: calendars.map((c) => ({ ...c, accountEmail: acc.email })),
          };
        } catch (e) {
          console.error(`Google Calendar çekilemedi (${acc.email}):`, e);
          return { events: [], calendars: [] };
        }
      })
    );

    const events = results
      .flatMap((r) => r.events)
      .sort((a: any, b: any) => {
        const aTime = a.startDateTime ? new Date(a.startDateTime).getTime() : 0;
        const bTime = b.startDateTime ? new Date(b.startDateTime).getTime() : 0;
        return aTime - bTime;
      });
    const calendars = results.flatMap((r) => r.calendars);

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
    const { accountEmail, calendarId, title, start, end, description, location, allDay, timeZone } = body;

    if (!accountEmail || !calendarId || !title || !start || !end) {
      return NextResponse.json(
        { error: "accountEmail, calendarId, title, start ve end alanları zorunludur." },
        { status: 400 }
      );
    }

    const accessToken = await getAccessTokenForAccount(accountEmail);
    if (!accessToken) {
      return NextResponse.json({ error: "Belirtilen Google hesabı bağlı değil." }, { status: 404 });
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

    return NextResponse.json({ ...event, accountEmail });
  } catch (err: any) {
    console.error("Etkinlik oluşturulamadı:", err);
    return NextResponse.json({ error: err?.message || "Etkinlik oluşturulamadı." }, { status: 500 });
  }
}

// PATCH /api/calendar/events -> Etkinliği Güncelle
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { accountEmail, calendarId, eventId, ...updates } = body;

    if (!accountEmail || !calendarId || !eventId) {
      return NextResponse.json(
        { error: "accountEmail, calendarId ve eventId alanları zorunludur." },
        { status: 400 }
      );
    }

    const accessToken = await getAccessTokenForAccount(accountEmail);
    if (!accessToken) {
      return NextResponse.json({ error: "Belirtilen Google hesabı bağlı değil." }, { status: 404 });
    }

    const event = await updateGoogleCalendarEvent(accessToken, calendarId, eventId, updates);
    return NextResponse.json(event);
  } catch (err: any) {
    console.error("Etkinlik güncellenemedi:", err);
    return NextResponse.json({ error: err?.message || "Etkinlik güncellenemedi." }, { status: 500 });
  }
}

// DELETE /api/calendar/events?accountEmail=...&calendarId=...&eventId=... -> Etkinliği Sil
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountEmail = searchParams.get("accountEmail");
    const calendarId = searchParams.get("calendarId");
    const eventId = searchParams.get("eventId");

    if (!accountEmail || !calendarId || !eventId) {
      return NextResponse.json(
        { error: "accountEmail, calendarId ve eventId parametreleri zorunludur." },
        { status: 400 }
      );
    }

    const accessToken = await getAccessTokenForAccount(accountEmail);
    if (!accessToken) {
      return NextResponse.json({ error: "Belirtilen Google hesabı bağlı değil." }, { status: 404 });
    }

    await deleteGoogleCalendarEvent(accessToken, calendarId, eventId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Etkinlik silinemedi:", err);
    return NextResponse.json({ error: err?.message || "Etkinlik silinemedi." }, { status: 500 });
  }
}
