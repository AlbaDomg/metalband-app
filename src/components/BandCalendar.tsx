'use client';

import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { BandEvent, EventCategory } from '@/types/database';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Guitar,
  MapPin,
  Mic2,
  Pin,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

const CATEGORY_META: Record<
  EventCategory,
  {
    label: string;
    badge: string;
    dot: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  rehearsal: {
    label: 'ENSAYO',
    badge: 'border-violet-800/80 bg-violet-950/60 text-violet-300',
    dot: 'bg-violet-500',
    Icon: Guitar,
  },
  gig: {
    label: 'CONCIERTO / GIG',
    badge: 'border-rose-800/80 bg-rose-950/70 text-rose-300',
    dot: 'bg-rose-500',
    Icon: Flame,
  },
  studio: {
    label: 'ESTUDIO / GRABACIÓN',
    badge: 'border-emerald-800/80 bg-emerald-950/60 text-emerald-300',
    dot: 'bg-emerald-400',
    Icon: Mic2,
  },
  other: {
    label: 'REUNIÓN / OTRO',
    badge: 'border-amber-800/80 bg-amber-950/50 text-amber-300',
    dot: 'bg-amber-400',
    Icon: Pin,
  },
};

const WEEKDAYS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function toDateString(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export default function BandCalendar() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [events, setEvents] = useState<BandEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Formulario nuevo evento
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(
    toDateString(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const [eventTime, setEventTime] = useState('20:00');
  const [category, setCategory] = useState<EventCategory>('rehearsal');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('metal_events');
      if (saved) setEvents(JSON.parse(saved));
      setLoading(false);

      const bc = new BroadcastChannel('abyss-realtime');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'EVENTS_UPDATED') {
          setEvents(ev.data.events);
        }
      };
      return () => bc.close();
    }

    const fetchEvents = async () => {
      const { data } = await supabase
        .from('band_events')
        .select('*')
        .order('event_date', { ascending: true });

      if (data) setEvents(data as BandEvent[]);
      setLoading(false);
    };

    fetchEvents();

    const channel = supabase
      .channel('realtime-band-events')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'band_events' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const added = payload.new as BandEvent;
            setEvents((prev) => {
              if (prev.some((e) => e.id === added.id)) return prev;
              return [...prev, added].sort((a, b) =>
                a.event_date.localeCompare(b.event_date)
              );
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as BandEvent;
            setEvents((prev) =>
              prev
                .map((e) => (e.id === updated.id ? updated : e))
                .sort((a, b) => a.event_date.localeCompare(b.event_date))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setEvents((prev) => prev.filter((e) => e.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) return;

    if (!isSupabaseConfigured) {
      const newEv: BandEvent = {
        id: `local-ev-${Date.now()}`,
        title: title.trim(),
        event_date: eventDate,
        event_time: eventTime || '20:00',
        category,
        location: location.trim(),
        notes: notes.trim(),
        created_by: 'local-member',
        creator_email: 'miembro',
        created_at: new Date().toISOString(),
      };
      const next = [...events, newEv].sort((a, b) =>
        a.event_date.localeCompare(b.event_date)
      );
      setEvents(next);
      localStorage.setItem('metal_events', JSON.stringify(next));
      const bc = new BroadcastChannel('abyss-realtime');
      bc.postMessage({ type: 'EVENTS_UPDATED', events: next });
      bc.close();
      setTitle('');
      setLocation('');
      setNotes('');
      setShowModal(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: inserted, error } = await supabase
      .from('band_events')
      .insert({
        title: title.trim(),
        event_date: eventDate,
        event_time: eventTime || '20:00',
        category,
        location: location.trim(),
        notes: notes.trim(),
        created_by: user?.id ?? null,
        creator_email: user?.email?.split('@')[0] ?? 'Miembro',
      })
      .select()
      .single();

    if (error) {
      alert(
        'Error al guardar evento. Asegúrate de haber ejecutado migration_calendar_and_files.sql en Supabase.'
      );
      return;
    }

    if (inserted) {
      const added = inserted as BandEvent;
      setEvents((prev) =>
        prev.some((ev) => ev.id === added.id)
          ? prev
          : [...prev, added].sort((a, b) =>
              a.event_date.localeCompare(b.event_date)
            )
      );
    }

    setTitle('');
    setLocation('');
    setNotes('');
    setShowModal(false);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!isSupabaseConfigured) {
      const next = events.filter((e) => e.id !== id);
      setEvents(next);
      localStorage.setItem('metal_events', JSON.stringify(next));
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== id));
    await supabase.from('band_events').delete().eq('id', id);
  };

  // Cálculo de cuadrícula del mes (Lunes como primer día)
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const filteredEvents = selectedDate
    ? events.filter((e) => e.event_date === selectedDate)
    : events;

  return (
    <div className="space-y-4">
      {/* Cabecera de Acción */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400 flex items-center gap-1.5">
          <CalendarIcon className="h-4 w-4 text-emerald-400" />
          Agenda & Fechas de la Banda ({events.length})
        </span>
        <button
          type="button"
          onClick={() => {
            if (selectedDate) setEventDate(selectedDate);
            setShowModal(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 px-3.5 py-2 text-xs font-black uppercase tracking-widest text-zinc-950 shadow-lg shadow-emerald-950/50 transition"
        >
          <Plus className="h-4 w-4" />
          Añadir Fecha
        </button>
      </div>

      {/* Cuadrícula Visual del Mes */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/75 backdrop-blur-md p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-100">
            {MONTHS[currentMonth]} {currentYear}
          </h3>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
          {WEEKDAYS.map((day) => (
            <span
              key={day}
              className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 py-1"
            >
              {day}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startOffset }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-11" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateStr = toDateString(currentYear, currentMonth, dayNum);
            const dayEvents = events.filter((e) => e.event_date === dateStr);
            const isSelected = selectedDate === dateStr;
            const isToday =
              dateStr ===
              toDateString(
                today.getFullYear(),
                today.getMonth(),
                today.getDate()
              );

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() =>
                  setSelectedDate(isSelected ? null : dateStr)
                }
                className={`relative flex h-11 flex-col items-center justify-center rounded-lg border text-xs font-mono transition ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-950/60 font-bold text-white'
                    : isToday
                    ? 'border-zinc-700 bg-zinc-900 font-bold text-emerald-400'
                    : 'border-zinc-900 bg-zinc-950 text-zinc-300 hover:border-zinc-800'
                }`}
              >
                <span>{dayNum}</span>
                {dayEvents.length > 0 && (
                  <div className="mt-1 flex items-center gap-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        className={`h-1.5 w-1.5 rounded-full ${
                          CATEGORY_META[ev.category].dot
                        }`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <div className="mt-3 flex items-center justify-between border-t border-zinc-900 pt-2.5 text-xs text-zinc-400">
            <span>
              Filtrando día: <strong className="text-zinc-200 font-mono">{selectedDate}</strong>
            </span>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-emerald-400 hover:underline text-[11px] font-bold uppercase"
            >
              Ver todas las fechas
            </button>
          </div>
        )}
      </div>

      {/* Lista de Eventos */}
      {loading ? (
        <div className="h-24 animate-pulse rounded-xl border border-zinc-900 bg-zinc-950" />
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50 p-8 text-center">
          <CalendarIcon className="mx-auto mb-2 h-7 w-7 text-zinc-600" />
          <p className="text-xs font-semibold text-zinc-300">
            {selectedDate
              ? 'No hay eventos programados para este día'
              : 'Todavía no hay fechas en el calendario de la banda'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredEvents.map((ev) => {
            const meta = CATEGORY_META[ev.category] || CATEGORY_META.other;
            const Icon = meta.Icon;

            return (
              <div
                key={ev.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${meta.badge}`}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      {ev.event_date}
                    </span>
                    {ev.event_time && (
                      <span className="flex items-center gap-1 font-mono text-xs text-zinc-400">
                        <Clock className="h-3 w-3 text-zinc-500" />
                        {ev.event_time}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-extrabold text-zinc-100">
                    {ev.title}
                  </h4>

                  {ev.location && (
                    <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <MapPin className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                      {ev.location}
                    </p>
                  )}

                  {ev.notes && (
                    <p className="text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-800/70 rounded-lg p-2 mt-1 whitespace-pre-wrap">
                      {ev.notes}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteEvent(ev.id)}
                  title="Eliminar evento"
                  className="rounded-lg p-1.5 text-zinc-600 hover:bg-rose-950/50 hover:text-rose-400 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nuevo Evento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-100">
                Nueva Fecha // Calendario
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  Evento / Motivo
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Ensayo General Setlist / Concierto Sala X"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                    Tipo de Evento
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as EventCategory)
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="rehearsal">Ensayo</option>
                    <option value="gig">Concierto / Directo</option>
                    <option value="studio">Estudio / Grabación</option>
                    <option value="other">Reunión / Entrega / Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                    Ubicación / Sala
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Local 4 / Estudio..."
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  Notas para la banda (opcional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Llevar in-ears, probar intro por PA..."
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 py-3 text-xs font-black uppercase tracking-[0.2em] text-zinc-950 transition"
              >
                Guardar y Sincronizar con la Banda
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

