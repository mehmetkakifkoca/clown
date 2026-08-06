"use client";

import { useEffect, useState } from "react";

interface GoogleCalendarInfo {
  id: string;
  name: string;
  color: string;
  primary: boolean;
}

interface GoogleCalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  startDateTime?: string;
  endDateTime?: string;
  location?: string;
  provider: string;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
}

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState<string>("2026-08-07");
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<GoogleCalendarInfo[]>([]);
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [newEvent, setNewEvent] = useState({
    calendarId: "",
    title: "",
    startTime: "09:00",
    endTime: "10:00",
    location: "",
    description: "",
  });

  const weekDays = [
    { day: "Pzt", date: "03", fullDate: "2026-08-03" },
    { day: "Sal", date: "04", fullDate: "2026-08-04" },
    { day: "Çar", date: "05", fullDate: "2026-08-05" },
    { day: "Per", date: "06", fullDate: "2026-08-06" },
    { day: "Cum", date: "07", fullDate: "2026-08-07" },
    { day: "Cmt", date: "08", fullDate: "2026-08-08" },
    { day: "Paz", date: "09", fullDate: "2026-08-09" },
  ];

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (calendars.length > 0 && !newEvent.calendarId) {
      const primary = calendars.find((c) => c.primary) || calendars[0];
      setNewEvent((prev) => ({ ...prev, calendarId: primary.id }));
    }
  }, [calendars]);

  const loadEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/calendar/events?days=30");
      const data = await res.json();
      setEvents(data.events || []);
      setCalendars(data.calendars || []);
    } catch {
      setError("Takvim etkinlikleri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const toggleCalendar = (calendarId: string) => {
    setHiddenCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(calendarId)) next.delete(calendarId);
      else next.add(calendarId);
      return next;
    });
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim() || !newEvent.calendarId) return;

    setSaving(true);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId: newEvent.calendarId,
          title: newEvent.title,
          description: newEvent.description,
          location: newEvent.location,
          start: `${selectedDate}T${newEvent.startTime}:00`,
          end: `${selectedDate}T${newEvent.endTime}:00`,
          timeZone,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Etkinlik oluşturulamadı.");
      }

      setShowAddModal(false);
      setNewEvent((prev) => ({ ...prev, title: "", location: "", description: "" }));
      await loadEvents();
    } catch (err: any) {
      alert(`Hata: ${err?.message || "Etkinlik oluşturulamadı."}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (evt: GoogleCalendarEvent) => {
    if (!confirm(`"${evt.title}" etkinliğini silmek istediğinize emin misiniz?`)) return;
    try {
      const params = new URLSearchParams({ calendarId: evt.calendarId, eventId: evt.id });
      const res = await fetch(`/api/calendar/events?${params.toString()}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Etkinlik silinemedi.");
      }
      await loadEvents();
    } catch (err: any) {
      alert(`Hata: ${err?.message || "Etkinlik silinemedi."}`);
    }
  };

  const visibleEvents = events.filter(
    (evt) => evt.date === selectedDate && !hiddenCalendars.has(evt.calendarId)
  );

  return (
    <div className="min-h-screen bg-background text-on-surface px-6 md:px-10 lg:px-14 pt-6 pb-28 md:pb-8">
      {/* Başlık */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-primary rounded-full" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider font-label-caps">
              Program & Ajanda
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-headline-lg text-on-surface tracking-tight mt-0.5">
            Takvim
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          {/* Haftalık / Aylık Toggle */}
          <div className="bg-surface-container p-1 rounded-full flex items-center border border-outline-variant/30">
            <button
              onClick={() => setViewMode("week")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all ${
                viewMode === "week" ? "bg-primary text-on-primary shadow-xs" : "text-secondary hover:text-on-surface"
              }`}
            >
              Haftalık
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all ${
                viewMode === "month" ? "bg-primary text-on-primary shadow-xs" : "text-secondary hover:text-on-surface"
              }`}
            >
              Aylık
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="hidden md:flex items-center space-x-2 px-4 py-2 bg-primary text-on-primary rounded-2xl font-semibold text-xs shadow-md hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Etkinlik Ekle</span>
          </button>
        </div>
      </header>

      {/* Ay Başlığı */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-base font-bold text-on-surface flex items-center">
          <span>Ağustos 2026</span>
          <span className="material-symbols-outlined text-[20px] ml-1 text-outline">expand_more</span>
        </h2>
        <span className="text-xs text-secondary font-label-sm font-medium">Bugün: Cum, 7 Ağu</span>
      </div>

      {/* Yatay Gün Seçici */}
      <div className="flex items-center space-x-2.5 overflow-x-auto pb-4 mb-4 scrollbar-none">
        {weekDays.map((item) => {
          const isSelected = selectedDate === item.fullDate;
          return (
            <button
              key={item.fullDate}
              onClick={() => setSelectedDate(item.fullDate)}
              className={`flex-1 min-w-[64px] py-3 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 border ${
                isSelected
                  ? "bg-primary text-on-primary border-primary shadow-md scale-105"
                  : "bg-surface-container-lowest text-on-surface border-outline-variant/30 hover:bg-surface-container-low"
              }`}
            >
              <span className={`text-[11px] font-semibold ${isSelected ? "text-on-primary/80" : "text-secondary"}`}>
                {item.day}
              </span>
              <span className="text-lg font-bold font-headline-lg mt-0.5">{item.date}</span>
            </button>
          );
        })}
      </div>

      {/* Takvim Filtreleri */}
      {calendars.length > 0 && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-4 mb-2 scrollbar-none">
          {calendars.map((cal) => {
            const isHidden = hiddenCalendars.has(cal.id);
            return (
              <button
                key={cal.id}
                onClick={() => toggleCalendar(cal.id)}
                className={`flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isHidden
                    ? "border-outline-variant/30 text-outline opacity-50"
                    : "border-outline-variant/30 text-on-surface bg-surface-container-lowest"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cal.color }}
                />
                <span>{cal.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Zaman Çizelgesi */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1 mb-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-secondary font-label-caps">
            Günlük Ajanda
          </h3>
          <span className="text-xs font-label-sm text-outline">{visibleEvents.length} Etkinlik</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-24 bg-surface-container-low animate-pulse rounded-2xl border border-outline-variant/20" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16 bg-error-container/20 rounded-3xl border border-error/30 p-6">
            <span className="material-symbols-outlined text-4xl text-error mb-2">error</span>
            <p className="text-sm font-semibold text-on-error-container mb-1">Bağlantı Hatası</p>
            <p className="text-xs text-secondary">{error}</p>
          </div>
        ) : visibleEvents.length === 0 ? (
          <div className="text-center py-12 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-6">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">event_busy</span>
            <p className="text-sm text-secondary font-medium">Bu gün için planlanmış etkinlik yok</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleEvents.map((evt) => (
              <div
                key={`${evt.calendarId}-${evt.id}`}
                className="rounded-2xl p-4 md:p-5 border border-outline-variant/30 bg-surface-container-lowest text-on-surface transition-all duration-200 shadow-[0_4px_20px_-2px_rgba(182,23,34,0.06)] hover:border-primary/40"
                style={{ borderLeftWidth: 4, borderLeftColor: evt.calendarColor }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center space-x-2 mb-1.5">
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md font-label-sm bg-surface-container text-secondary"
                      >
                        {evt.calendarName}
                      </span>
                      <span className="text-[10px] font-label-sm text-outline">{evt.provider}</span>
                    </div>

                    <h4 className="text-sm md:text-base font-bold leading-snug text-on-surface">{evt.title}</h4>

                    {evt.location && (
                      <p className="text-xs flex items-center mt-2 text-secondary">
                        <span className="material-symbols-outlined text-[15px] mr-1">location_on</span>
                        {evt.location}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end space-y-2 flex-shrink-0">
                    <div className="px-3 py-2 rounded-xl text-center border bg-surface-container-low border-outline-variant/30 text-on-surface">
                      <div className="text-[11px] font-bold font-label-sm">{evt.startTime}</div>
                      <div className="text-[9px] font-label-sm opacity-80">{evt.endTime}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteEvent(evt)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-outline hover:text-error hover:bg-error-container/20 transition-colors"
                      title="Etkinliği Sil"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobil FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="md:hidden fixed bottom-20 right-5 z-40 w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
        title="Etkinlik Ekle"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

      {/* Etkinlik Ekle Modalı */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-outline-variant/30 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container-high">
              <h2 className="text-lg font-bold font-headline-lg text-on-surface">Yeni Etkinlik</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-secondary block mb-1">Takvim:</label>
                <select
                  required
                  value={newEvent.calendarId}
                  onChange={(e) => setNewEvent({ ...newEvent, calendarId: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                >
                  {calendars.length === 0 && <option value="">Takvim bulunamadı</option>}
                  {calendars.map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      {cal.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-secondary block mb-1">Etkinlik Adı:</label>
                <input
                  type="text"
                  required
                  placeholder="örn. Tasarım Toplantısı"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-secondary block mb-1">Başlangıç:</label>
                  <input
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface font-label-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-secondary block mb-1">Bitiş:</label>
                  <input
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface font-label-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-secondary block mb-1">Konum:</label>
                <input
                  type="text"
                  placeholder="örn. Google Meet / Oda 402"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-secondary block mb-1">Açıklama:</label>
                <textarea
                  placeholder="Etkinlik açıklaması (opsiyonel)"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  rows={2}
                  className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-secondary hover:bg-surface-container rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving || calendars.length === 0}
                  className="px-5 py-2.5 text-xs font-semibold bg-primary text-on-primary rounded-xl shadow-md hover:bg-primary-container transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
                  <span>{saving ? "Kaydediliyor..." : "Etkinliği Kaydet"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
