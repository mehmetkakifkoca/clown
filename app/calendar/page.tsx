"use client";

import { useEffect, useState } from "react";

interface GoogleCalendarInfo {
  id: string;
  name: string;
  color: string;
  primary: boolean;
  accountEmail: string;
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
  accountEmail: string;
}

function calendarKey(accountEmail: string, calendarId: string) {
  return `${accountEmail}::${calendarId}`;
}

// Native JS Date Helpers
const getMonday = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const getWeekDays = (date: Date) => {
  const monday = getMonday(date);
  const week = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    week.push(d);
  }
  return week;
};

const getMonthDays = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDayOffset = firstDay.getDay() === 0 ? -6 : 1 - firstDay.getDay();
  const startDate = new Date(year, month, 1 + startDayOffset);
  
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    days.push(d);
    if (i >= 27 && d.getMonth() !== month && d.getDay() === 0) {
      break; 
    }
  }
  return days;
};

const formatDateObj = (d: Date) => {
  const offset = d.getTimezoneOffset();
  const adjusted = new Date(d.getTime() - (offset * 60 * 1000));
  return adjusted.toISOString().split("T")[0];
};

const shortDays = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export default function CalendarPage() {
  const todayStr = formatDateObj(new Date());
  
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());
  
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<GoogleCalendarInfo[]>([]);
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [newEvent, setNewEvent] = useState({
    calendarKey: "",
    title: "",
    startTime: "09:00",
    endTime: "10:00",
    location: "",
    description: "",
  });

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (calendars.length > 0 && !newEvent.calendarKey) {
      const primary = calendars.find((c) => c.primary) || calendars[0];
      setNewEvent((prev) => ({ ...prev, calendarKey: calendarKey(primary.accountEmail, primary.id) }));
    }
  }, [calendars]);

  // Sync selected date with the view date
  useEffect(() => {
    setCurrentViewDate(new Date(selectedDateStr));
  }, [selectedDateStr]);

  const loadEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/calendar/events?days=90"); // Fetching more days for monthly view flexibility
      const data = await res.json();
      setEvents(data.events || []);
      setCalendars(data.calendars || []);
    } catch {
      setError("Takvim etkinlikleri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const toggleCalendar = (key: string) => {
    setHiddenCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim() || !newEvent.calendarKey) return;
    const selectedCal = calendars.find((c) => calendarKey(c.accountEmail, c.id) === newEvent.calendarKey);
    if (!selectedCal) return;
    setSaving(true);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountEmail: selectedCal.accountEmail,
          calendarId: selectedCal.id,
          title: newEvent.title,
          description: newEvent.description,
          location: newEvent.location,
          start: `${selectedDateStr}T${newEvent.startTime}:00`,
          end: `${selectedDateStr}T${newEvent.endTime}:00`,
          timeZone,
        }),
      });
      if (!res.ok) throw new Error("Etkinlik oluşturulamadı.");
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
      const params = new URLSearchParams({
        accountEmail: evt.accountEmail,
        calendarId: evt.calendarId,
        eventId: evt.id,
      });
      const res = await fetch(`/api/calendar/events?${params.toString()}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Etkinlik silinemedi.");
      await loadEvents();
    } catch (err: any) {
      alert(`Hata: ${err?.message || "Etkinlik silinemedi."}`);
    }
  };

  const handlePrev = () => {
    const d = new Date(currentViewDate);
    if (viewMode === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentViewDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentViewDate);
    if (viewMode === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentViewDate(d);
  };

  const handleToday = () => {
    setSelectedDateStr(todayStr);
    setCurrentViewDate(new Date());
  };

  const visibleEvents = events.filter(
    (evt) => evt.date === selectedDateStr && !hiddenCalendars.has(calendarKey(evt.accountEmail, evt.calendarId))
  );

  const daysToRender = viewMode === "week" ? getWeekDays(currentViewDate) : getMonthDays(currentViewDate);
  const currentMonthName = monthNames[currentViewDate.getMonth()];
  const currentYear = currentViewDate.getFullYear();

  return (
    <div className="min-h-screen bg-background text-on-surface px-4 md:px-10 lg:px-14 pt-6 pb-28 md:pb-8 selection:bg-primary/20">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0 select-none">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-primary rounded-full" />
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider font-label-caps">
              Program & Ajanda
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold font-headline-lg text-on-surface tracking-tight mt-0.5">
            Takvim
          </h1>
        </div>

        <div className="flex items-center space-x-2 md:space-x-3 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {/* Today Button */}
          <button
            onClick={handleToday}
            className="flex-shrink-0 px-4 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-full text-xs font-bold text-on-surface transition-colors shadow-2xs border border-outline-variant/30"
          >
            Bugün
          </button>
          
          {/* View Toggles */}
          <div className="flex-shrink-0 bg-surface-container p-1 rounded-full flex items-center border border-outline-variant/30 shadow-2xs">
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
            className="flex-shrink-0 flex items-center space-x-1.5 px-4 py-2 bg-primary text-on-primary rounded-full font-bold text-xs shadow-md hover:bg-primary-container transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span className="hidden md:inline">Etkinlik Ekle</span>
          </button>
        </div>
      </header>

      {/* Date Navigation & Calendar Grids */}
      <div className="mb-6 select-none">
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl md:text-2xl font-bold text-on-surface flex items-center tracking-tight">
              {currentMonthName} {currentYear}
            </h2>
            <div className="flex items-center space-x-1">
              <button onClick={handlePrev} className="w-7 h-7 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button onClick={handleNext} className="w-7 h-7 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid Container */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-3 md:p-4 shadow-sm">
          {/* Day Names Row */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => (
              <div key={dayIdx} className="text-center text-[10px] font-bold uppercase tracking-wider text-outline font-label-caps py-1">
                {shortDays[dayIdx]}
              </div>
            ))}
          </div>
          
          {/* Days Grid */}
          <div className={`grid grid-cols-7 gap-1 md:gap-2 ${viewMode === "month" ? "auto-rows-fr" : ""}`}>
            {daysToRender.map((dateObj, idx) => {
              const dateStr = formatDateObj(dateObj);
              const isSelected = selectedDateStr === dateStr;
              const isToday = dateStr === todayStr;
              const isCurrentMonth = dateObj.getMonth() === currentViewDate.getMonth();
              
              // Count events for this day
              const dayEvents = events.filter(e => e.date === dateStr && !hiddenCalendars.has(calendarKey(e.accountEmail, e.calendarId)));
              
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDateStr(dateStr)}
                  className={`flex flex-col items-center justify-start p-1.5 md:p-2 rounded-2xl transition-all duration-200 border relative ${
                    viewMode === "month" ? "min-h-[50px] md:min-h-[70px]" : "py-3 min-h-[70px]"
                  } ${
                    isSelected
                      ? "bg-primary text-on-primary border-primary shadow-md transform scale-105 z-10"
                      : "bg-transparent border-transparent hover:bg-surface-container text-on-surface"
                  } ${!isCurrentMonth && viewMode === "month" ? "opacity-30" : "opacity-100"}`}
                >
                  <span className={`text-base md:text-lg font-bold font-headline-lg ${
                    isToday && !isSelected ? "text-primary bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center" : ""
                  }`}>
                    {dateObj.getDate()}
                  </span>
                  
                  {/* Event Indicators */}
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-1">
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <span key={i} className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: isSelected ? "white" : e.calendarColor }} />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-outline flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Calendars Filter Toggles */}
      {calendars.length > 0 && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-4 mb-4 scrollbar-none select-none">
          {calendars.map((cal) => {
            const key = calendarKey(cal.accountEmail, cal.id);
            const isHidden = hiddenCalendars.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleCalendar(key)}
                className={`flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isHidden
                    ? "border-outline-variant/30 text-outline opacity-50 bg-surface-container-low"
                    : "border-outline-variant/30 text-on-surface bg-surface-container-lowest hover:border-primary/50"
                }`}
                title={cal.accountEmail}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isHidden ? "opacity-40" : ""}`}
                  style={{ backgroundColor: cal.color }}
                />
                <span>{cal.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Events Timeline for Selected Date */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1 mb-2 select-none">
          <h3 className="text-xs font-bold uppercase tracking-wider text-secondary font-label-caps">
            Günlük Ajanda - {new Date(selectedDateStr).toLocaleDateString("tr-TR", { day: 'numeric', month: 'long' })}
          </h3>
          <span className="text-[10px] font-bold px-2 py-1 bg-surface-container rounded-lg text-outline">{visibleEvents.length} Etkinlik</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-24 bg-surface-container-low animate-pulse rounded-3xl border border-outline-variant/20" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-10 bg-error-container/20 rounded-3xl border border-error/30 p-6 select-none">
            <span className="material-symbols-outlined text-3xl text-error mb-2">error</span>
            <p className="text-sm font-semibold text-on-error-container mb-1">Bağlantı Hatası</p>
            <p className="text-xs text-secondary">{error}</p>
          </div>
        ) : visibleEvents.length === 0 ? (
          <div className="text-center py-12 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-6 shadow-xs select-none">
            <span className="material-symbols-outlined text-5xl text-outline/40 mb-3 block">event_busy</span>
            <p className="text-sm text-secondary font-bold">Bu gün için planlanmış etkinlik yok</p>
            <p className="text-[11px] text-outline mt-1 max-w-xs mx-auto">Zamanınızı oluşturmak ve yönetmek için etkinlik ekleyin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleEvents.map((evt) => (
              <div
                key={`${evt.accountEmail}-${evt.calendarId}-${evt.id}`}
                className="rounded-3xl p-4 md:p-5 border border-outline-variant/30 bg-surface-container-lowest text-on-surface transition-all duration-200 shadow-xs hover:border-primary/40 relative overflow-hidden group"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5 opacity-80" style={{ backgroundColor: evt.calendarColor }} />
                
                <div className="flex items-start justify-between pl-2">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center space-x-2 mb-2 select-none">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md font-label-caps bg-surface-container text-secondary">
                        {evt.calendarName}
                      </span>
                    </div>

                    <h4 className="text-sm md:text-base font-extrabold leading-snug text-on-surface">{evt.title}</h4>

                    {evt.location && (
                      <p className="text-xs flex items-center mt-2.5 text-secondary">
                        <span className="material-symbols-outlined text-[16px] mr-1">location_on</span>
                        {evt.location}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end space-y-3 flex-shrink-0 select-none">
                    <div className="px-3 py-2 rounded-2xl text-center border bg-surface-container-low/40 border-outline-variant/30 text-on-surface shadow-2xs">
                      <div className="text-[11px] font-black">{evt.startTime}</div>
                      <div className="text-[9px] font-bold text-outline opacity-80">{evt.endTime}</div>
                    </div>
                    
                    <button
                      onClick={() => handleDeleteEvent(evt)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-error hover:bg-error-container/40 transition-colors opacity-0 group-hover:opacity-100 md:opacity-100"
                      title="Etkinliği Sil"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile Add Event FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="md:hidden fixed bottom-20 right-5 z-40 w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200"
        title="Etkinlik Ekle"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-outline-variant/30 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-surface-container-high">
              <h2 className="text-lg font-extrabold font-headline-lg text-on-surface">Yeni Etkinlik</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-secondary block mb-1">Takvim:</label>
                <select
                  required
                  value={newEvent.calendarKey}
                  onChange={(e) => setNewEvent({ ...newEvent, calendarKey: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm font-medium bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                >
                  {calendars.length === 0 && <option value="">Takvim bulunamadı</option>}
                  {calendars.map((cal) => (
                    <option key={calendarKey(cal.accountEmail, cal.id)} value={calendarKey(cal.accountEmail, cal.id)}>
                      {cal.name} ({cal.accountEmail})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-secondary block mb-1">Etkinlik Adı:</label>
                <input
                  type="text"
                  required
                  placeholder="örn. Tasarım Toplantısı"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm font-medium bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-secondary block mb-1">Başlangıç:</label>
                  <input
                    type="time"
                    required
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface font-label-sm font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-secondary block mb-1">Bitiş:</label>
                  <input
                    type="time"
                    required
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface font-label-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-secondary block mb-1">Konum:</label>
                <input
                  type="text"
                  placeholder="örn. Google Meet / Oda 402"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm font-medium bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-secondary block mb-1">Açıklama (Opsiyonel):</label>
                <textarea
                  placeholder="Etkinlik açıklaması veya notları..."
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  rows={2}
                  className="w-full px-3.5 py-2.5 text-sm font-medium bg-surface-container-low rounded-xl border border-outline-variant/30 focus:outline-none focus:border-primary text-on-surface resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-secondary hover:bg-surface-container rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving || calendars.length === 0}
                  className="px-6 py-2.5 text-xs font-extrabold bg-primary text-on-primary rounded-xl shadow-md hover:bg-primary-container transition-all active:scale-95 flex items-center space-x-1.5 disabled:opacity-50"
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
