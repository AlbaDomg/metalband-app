'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  INITIAL_DEMO_SONGS,
  isSupabaseConfigured,
  supabase,
} from '@/lib/supabase/client';
import { Song, SongStatus, StemStatus } from '@/types/database';
import BandCalendar from '@/components/BandCalendar';
import FilesManager from '@/components/FilesManager';
import {
  Activity,
  Calendar,
  ChevronRight,
  Database,
  Disc3,
  Flame,
  FolderOpen,
  Gauge,
  Guitar,
  LogOut,
  Plus,
  Radio,
  Sliders,
  X,
} from 'lucide-react';

const STATUS_BADGE: Record<SongStatus, { label: string; classes: string }> = {
  idea: {
    label: 'IDEA / RIFF',
    classes: 'border-zinc-700 bg-zinc-900 text-zinc-400',
  },
  demo: {
    label: 'PRE-PROD DEMO',
    classes: 'border-violet-800/70 bg-violet-950/50 text-violet-300',
  },
  finished: {
    label: 'MASTER READY',
    classes: 'border-rose-800/80 bg-rose-950/60 text-rose-300',
  },
};

function calculateStemProgress(song: Song): number {
  const stems: StemStatus[] = [
    song.drums_status,
    song.bass_status,
    song.rhythm_guitar_status,
    song.lead_guitar_status,
    song.clean_vocals_status,
    song.harsh_vocals_status,
  ];
  const score = stems.reduce((acc, s) => {
    if (s === 'done') return acc + 1;
    if (s === 'in_progress') return acc + 0.5;
    return acc;
  }, 0);
  return Math.round((score / stems.length) * 100);
}

type ActiveTab = 'songs' | 'calendar' | 'files';

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('songs');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [title, setTitle] = useState('');
  const [tuning, setTuning] = useState('Drop C');
  const [tempo, setTempo] = useState(145);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('abyss_songs');
      if (saved) {
        setSongs(JSON.parse(saved));
      } else {
        localStorage.setItem('abyss_songs', JSON.stringify(INITIAL_DEMO_SONGS));
        setSongs(INITIAL_DEMO_SONGS);
      }
      setLoading(false);

      const bc = new BroadcastChannel('abyss-realtime');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'SONGS_UPDATED') {
          setSongs(ev.data.songs);
        }
      };
      return () => bc.close();
    }

    const checkSessionAndFetch = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('songs')
        .select('*')
        .order('updated_at', { ascending: false });

      if (data) setSongs(data as Song[]);
      setLoading(false);
    };

    checkSessionAndFetch();

    // SUSCRIPCIÓN REALTIME A LA TABLA `songs`
    const channel = supabase
      .channel('realtime-songs-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'songs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newSong = payload.new as Song;
            setSongs((prev) =>
              prev.some((s) => s.id === newSong.id) ? prev : [newSong, ...prev]
            );
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Song;
            setSongs((prev) =>
              prev.map((song) => (song.id === updated.id ? updated : song))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setSongs((prev) => prev.filter((song) => song.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const handleCreateSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (!isSupabaseConfigured) {
      const newSong: Song = {
        id: `local-${Date.now()}`,
        title: title.trim(),
        tuning: tuning.trim() || 'Drop C',
        tempo: Number(tempo) || 140,
        lyrics: '',
        status: 'idea',
        drums_status: 'pending',
        bass_status: 'pending',
        rhythm_guitar_status: 'pending',
        lead_guitar_status: 'pending',
        clean_vocals_status: 'pending',
        harsh_vocals_status: 'pending',
        created_by: 'local-member',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const next = [newSong, ...songs];
      setSongs(next);
      localStorage.setItem('abyss_songs', JSON.stringify(next));
      const bc = new BroadcastChannel('abyss-realtime');
      bc.postMessage({ type: 'SONGS_UPDATED', songs: next });
      bc.close();
      setTitle('');
      setShowNewModal(false);
      return;
    }

    const { error } = await supabase.from('songs').insert({
      title: title.trim(),
      tuning: tuning.trim() || 'Drop C',
      tempo: Number(tempo) || 140,
      status: 'idea',
    });

    if (!error) {
      setTitle('');
      setShowNewModal(false);
    }
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    router.push('/login');
  };

  return (
    <div className="px-4 pt-5">
      {!isSupabaseConfigured && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-violet-800/60 bg-violet-950/30 px-3 py-2 text-[11px] text-violet-200">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-violet-400 shrink-0" />
            <span>
              <strong>Modo Local Realtime Activo:</strong> Sincronizado entre pestañas. Añade tus claves en <code className="text-rose-300">.env.local</code> cuando crees tu proyecto en Supabase.
            </span>
          </div>
        </div>
      )}

      {/* Header Industrial */}
      <header className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-950/80 border border-rose-800/60 text-rose-500">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-[0.2em] uppercase text-zinc-100">
                METAL // STUDIO
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-900/60 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                <Radio className="h-2.5 w-2.5 animate-pulse" />
                LIVE SYNC
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 tracking-wider uppercase">
              Setlist, Calendario & Rider Hub
            </p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          title="Cambiar usuario / Login"
          className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* Navegación por Pestañas (Temas / Calendario / Rider & Archivos) */}
      <div className="mb-6 grid grid-cols-3 gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950 p-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('songs')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-extrabold uppercase tracking-wider transition ${
            activeTab === 'songs'
              ? 'bg-rose-800 text-white shadow-md shadow-rose-950/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Disc3 className="h-3.5 w-3.5" />
          <span>Temas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-extrabold uppercase tracking-wider transition ${
            activeTab === 'calendar'
              ? 'bg-rose-800 text-white shadow-md shadow-rose-950/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Calendario</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-extrabold uppercase tracking-wider transition ${
            activeTab === 'files'
              ? 'bg-rose-800 text-white shadow-md shadow-rose-950/60'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>Rider & Logos</span>
        </button>
      </div>

      {/* CONTENIDO PESTAÑA 1: TEMAS DEL PROYECTO */}
      {activeTab === 'songs' && (
        <>
          <div className="mb-5 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400 flex items-center gap-1.5">
              <Disc3 className="h-4 w-4 text-rose-500" />
              Temas del Proyecto ({songs.length})
            </span>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 active:scale-95 px-3.5 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-rose-950/50 transition"
            >
              <Plus className="h-4 w-4" />
              Nuevo Tema
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className="h-24 animate-pulse rounded-xl border border-zinc-900 bg-zinc-950"
                />
              ))}
            </div>
          ) : songs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50 p-10 text-center">
              <Sliders className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm font-semibold text-zinc-300">
                No hay temas en la maqueta todavía
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Crea el primer tema para empezar a subir riffs y letras en tiempo real.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {songs.map((song) => {
                const progress = calculateStemProgress(song);
                const badge = STATUS_BADGE[song.status];

                return (
                  <Link
                    key={song.id}
                    href={`/songs/${song.id}`}
                    className="group block rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4 transition hover:border-rose-800/60 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase mb-1.5 ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                        <h2 className="text-base font-extrabold tracking-wide text-zinc-100 group-hover:text-rose-400 transition">
                          {song.title}
                        </h2>
                      </div>
                      <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-rose-400 transition shrink-0 mt-1" />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                      <span className="flex items-center gap-1.5 font-mono">
                        <Guitar className="h-3.5 w-3.5 text-violet-400" />
                        {song.tuning}
                      </span>
                      <span className="flex items-center gap-1.5 font-mono">
                        <Gauge className="h-3.5 w-3.5 text-rose-500" />
                        {song.tempo} BPM
                      </span>
                      <span className="flex items-center gap-1.5 font-mono ml-auto text-[11px] text-zinc-400">
                        <Activity className="h-3.5 w-3.5 text-emerald-400" />
                        Stems: {progress}%
                      </span>
                    </div>

                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
                      <div
                        className="h-full bg-gradient-to-r from-rose-700 via-violet-600 to-emerald-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* CONTENIDO PESTAÑA 2: CALENDARIO COMPARTIDO */}
      {activeTab === 'calendar' && <BandCalendar />}

      {/* CONTENIDO PESTAÑA 3: ARCHIVOS GENERALES DE LA BANDA (RIDERS, LOGOS, BACKDROPS) */}
      {activeTab === 'files' && (
        <FilesManager
          songId={null}
          sectionTitle="Archivos Generales de la Banda (Riders Técnicos, Stage Plots, Logos, Backdrops)"
        />
      )}

      {/* Modal Crear Canción */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-100">
                Nuevo Tema // Proyecto
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSong} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  Título Provisional o Definitivo
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-rose-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                    Afinación
                  </label>
                  <input
                    type="text"
                    value={tuning}
                    onChange={(e) => setTuning(e.target.value)}
                    placeholder="Drop F# / Drop C"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm font-mono text-zinc-100 focus:border-rose-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                    Tempo (BPM)
                  </label>
                  <input
                    type="number"
                    min={40}
                    max={300}
                    value={tempo}
                    onChange={(e) => setTempo(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm font-mono text-zinc-100 focus:border-rose-700 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-rose-800 hover:bg-rose-700 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white transition"
              >
                Crear y Sincronizar con la Banda
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
