'use client';

import { Song, StemField, StemStatus } from '@/types/database';
import {
  CheckCircle2,
  Clock,
  CircleDot,
  Drum,
  Guitar,
  Mic,
  Flame,
  Waves,
} from 'lucide-react';

interface StemTrackerProps {
  song: Song;
  onUpdateStem: (field: StemField, nextStatus: StemStatus) => void;
}

const STEMS: {
  field: StemField;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { field: 'drums_status', label: 'Batería', icon: Drum },
  { field: 'bass_status', label: 'Bajo', icon: Waves },
  { field: 'rhythm_guitar_status', label: 'Guit. Rítmica', icon: Guitar },
  { field: 'lead_guitar_status', label: 'Guit. Lead', icon: Guitar },
  { field: 'clean_vocals_status', label: 'Voces Limpias', icon: Mic },
  { field: 'harsh_vocals_status', label: 'Guturales / Screams', icon: Flame },
];

const STATUS_ORDER: StemStatus[] = ['pending', 'in_progress', 'done'];

const STATUS_UI: Record<
  StemStatus,
  {
    label: string;
    container: string;
    dot: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pending: {
    label: 'Pendiente',
    container: 'border-zinc-800 bg-zinc-900/60 text-zinc-400',
    dot: 'text-zinc-500',
    Icon: CircleDot,
  },
  in_progress: {
    label: 'Grabando',
    container: 'border-amber-800/70 bg-amber-950/30 text-amber-200',
    dot: 'text-amber-400 animate-pulse',
    Icon: Clock,
  },
  done: {
    label: 'Listo',
    container: 'border-emerald-800/70 bg-emerald-950/30 text-emerald-200',
    dot: 'text-emerald-400',
    Icon: CheckCircle2,
  },
};

export default function StemTracker({ song, onUpdateStem }: StemTrackerProps) {
  const handleCycle = (field: StemField) => {
    const current = song[field];
    const nextIndex = (STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length;
    onUpdateStem(field, STATUS_ORDER[nextIndex]);
  };

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/75 backdrop-blur-md p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-300">
          Stem Tracker // Estado de Pistas
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          Toca para alternar estado
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {STEMS.map(({ field, label, icon: InstrumentIcon }) => {
          const status = song[field];
          const ui = STATUS_UI[status];
          const StatusIcon = ui.Icon;

          return (
            <button
              key={field}
              type="button"
              onClick={() => handleCycle(field)}
              className={`flex flex-col justify-between rounded-lg border p-3 text-left transition active:scale-95 ${ui.container}`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <InstrumentIcon className="h-4 w-4 opacity-80" />
                <StatusIcon className={`h-4 w-4 ${ui.dot}`} />
              </div>
              <div>
                <p className="text-xs font-bold tracking-wide">{label}</p>
                <p className="text-[10px] uppercase tracking-widest opacity-75 mt-0.5">
                  {ui.label}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

