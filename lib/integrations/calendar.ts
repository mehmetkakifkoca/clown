// Calendar Provider Interface & Mock Implementation
// TODO: connect real Google Calendar / Outlook Calendar OAuth credentials

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  location?: string;
  category: "Work" | "Personal" | "Urgent" | "Design" | "Health";
  isUrgent: boolean;
  provider: "Google" | "Outlook" | "Local";
}

const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: "evt-1",
    title: "Product Design Sprint & Token Review",
    date: "2026-08-03",
    startTime: "09:30 AM",
    endTime: "10:30 AM",
    location: "Google Meet",
    category: "Design",
    isUrgent: false,
    provider: "Google"
  },
  {
    id: "evt-2",
    title: "CRITICAL: Q3 Server Migration & Security Deployment",
    date: "2026-08-03",
    startTime: "11:00 AM",
    endTime: "12:30 PM",
    location: "War Room Alpha",
    category: "Urgent",
    isUrgent: true,
    provider: "Outlook"
  },
  {
    id: "evt-3",
    title: "Lunch with Engineering Team & Julianne",
    date: "2026-08-03",
    startTime: "01:00 PM",
    endTime: "02:00 PM",
    location: "Artisan Bistro",
    category: "Personal",
    isUrgent: false,
    provider: "Local"
  },
  {
    id: "evt-4",
    title: "Notion Editor Architecture & Database Schema Sync",
    date: "2026-08-03",
    startTime: "03:30 PM",
    endTime: "04:30 PM",
    location: "Room 402",
    category: "Work",
    isUrgent: false,
    provider: "Google"
  },
  {
    id: "evt-5",
    title: "Weekly Social Media Growth Strategy Sync",
    date: "2026-08-04",
    startTime: "10:00 AM",
    endTime: "11:00 AM",
    location: "Zoom",
    category: "Work",
    isUrgent: false,
    provider: "Google"
  }
];

export class UnifiedCalendarProvider {
  // TODO: connect real Google/Outlook Calendar OAuth API

  async listEvents(date?: string): Promise<CalendarEvent[]> {
    if (date) {
      return MOCK_EVENTS.filter(e => e.date === date);
    }
    return MOCK_EVENTS;
  }

  async createEvent(eventData: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    const newEvt: CalendarEvent = {
      ...eventData,
      id: `evt-${Date.now()}`
    };
    MOCK_EVENTS.push(newEvt);
    return newEvt;
  }
}

export const calendarProvider = new UnifiedCalendarProvider();
