'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  INITIAL_DEMO_SONGS,
  isSupabaseConfigured,
  supabase,
} from '@/lib/supabase/client';
import { Song, SongStatus, StemField, StemStatus } from '@/types/database';
import StemTracker from '@/components/StemTracker';
import TeleprompterModal from '@/components/TeleprompterModal';
import AudioSection from '@/components/AudioSection';
import FilesManager from '@/components/FilesManager';
import RealtimeStatusBadge from '@/components/RealtimeStatusBadge';
import {
  ArrowLeft,
  Check,
  FileText,
  Gauge,
  Guitar,
  Loader2,
  Maximize2,
  Radio,
  Save,
  Trash2,
} from 'lucide-react';

export default function SongDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: songId } = use(params);
  const router = useRouter();

  const [song, setSong] = useState<Song | null>(null);
  const [lyricsDraft, setLyricsDraft] = useState('');
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [savingLyrics, setSavingLyrics] = useState(false);
  const [teleprompterOpen, setTeleprompterOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    'connecting' | 'subscribed' | 'error'
  >('connecting');

  const syncLocalSong = (updated: Song) => {
    setSong(updated);
    const saved = localStorage.getItem('abyss_songs');
    const list: Song[] = saved ? JSON.parse(saved) : INITIAL_DEMO_SONGS;
    const nextList = list.map((s) => (s.id === updated.id ? updated : s));
    localStorage.setItem('abyss_songs', JSON.stringify(nextList));
    const bc = new BroadcastChannel('abyss-realtime');
    bc.postMessage({ type: 'SONGS_UPDATED', songs: nextList });
    bc.postMessage({ type: 'SONG_DETAIL_UPDATED', song: updated });
    bc.close();
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('abyss_songs');
      const list: Song[] = saved ? JSON.parse(saved) : INITIAL_DEMO_SONGS;
      const found = list.find((s) => s.id === songId);
      if (!found) {
        router.push('/');
        return;
      }
      setSong(found);
      setLyricsDraft(found.lyrics || '');
      setSyncStatus('subscribed');

      const bc = new BroadcastChannel('abyss-realtime');
      bc.onmessage = (ev) => {
        if (
          ev.data?.type === 'SONG_DETAIL_UPDATED' &&
          ev.data.song?.id === songId
        ) {
          setSong(ev.data.song);
          setIsEditingLyrics((typing) => {
            if (!typing) setLyricsDraft(ev.data.song.lyrics || '');
            return typing;
          });
        }
      };
      return () => bc.close();
    }

    const fetchSong = async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('id', songId)
        .single();

      if (error || !data) {
        router.push('/');
        return;
      }

      const loaded = data as Song;
      setSong(loaded);
      setLyricsDraft(loaded.lyrics || '');
    };

    fetchSong();

    // SUSCRIPCIÓN REALTIME AL DETALLE DE LA CANCIÓN
    const songChannel = supabase
      .channel(`realtime-song-detail-${songId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'songs',
          filter: `id=eq.${songId}`,
        },
        (payload) => {
          const updated = payload.new as Song;
          setSong(updated);
          setIsEditingLyrics((currentlyTyping) => {
            if (!currentlyTyping) {
              setLyricsDraft(updated.lyrics || '');
            }
            return currentlyTyping;
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setSyncStatus('subscribed');
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setSyncStatus('error');
        } else {
          setSyncStatus('connecting');
        }
      });

    return () => {
      supabase.removeChannel(songChannel);
    };
  }, [songId, router]);

  const handleUpdateStem = async (field: StemField, nextStatus: StemStatus) => {
    if (!song) return;
    const updated = { ...song, [field]: nextStatus };
    if (!isSupabaseConfigured) {
      syncLocalSong(updated);
      return;
    }
    setSong(updated);
    await supabase
      .from('songs')
      .update({ [field]: nextStatus })
      .eq('id', song.id);
  };

  const handleUpdateStatus = async (status: SongStatus) => {
    if (!song) return;
    const updated = { ...song, status };
    if (!isSupabaseConfigured) {
      syncLocalSong(updated);
      return;
    }
    setSong(updated);
    await supabase.from('songs').update({ status }).eq('id', song.id);
  };

  const handleSaveLyrics = async () => {
    if (!song) return;
    setSavingLyrics(true);
    const updated = { ...song, lyrics: lyricsDraft };
    if (!isSupabaseConfigured) {
      syncLocalSong(updated);
      setSavingLyrics(false);
      setIsEditingLyrics(false);
      return;
    }
    await supabase
      .from('songs')
      .update({ lyrics: lyricsDraft })
      .eq('id', song.id);
    setSavingLyrics(false);
    setIsEditingLyrics(false);
  };

  const handleDeleteSong = async () => {
    if (!song) return;
    if (!confirm(`¿Seguro que quieres eliminar el tema "${song.title}" y todos sus archivos?`)) {
      return;
    }
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('abyss_songs');
      const list: Song[] = saved ? JSON.parse(saved) : INITIAL_DEMO_SONGS;
      const nextList = list.filter((s) => s.id !== song.id);
      localStorage.setItem('abyss_songs', JSON.stringify(nextList));
      router.push('/');
      return;
    }
    await supabase.from('songs').delete().eq('id', song.id);
    router.push('/');
  };

  if (!song) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-5 space-y-5">
      {/* Navegación Superior */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Setlist
        </Link>

        <div className="flex items-center gap-2">
          <RealtimeStatusBadge channelStatus={syncStatus} />

          <select
            value={song.status}
            onChange={(e) => handleUpdateStatus(e.target.value as SongStatus)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="idea">IDEA / RIFF</option>
            <option value="demo">PRE-PROD DEMO</option>
            <option value="finished">MASTER READY</option>
          </select>

          <button
            type="button"
            onClick={handleDeleteSong}
            title="Eliminar canción"
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 hover:border-rose-800 hover:bg-rose-950/50 hover:text-rose-400 transition"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Cabecera de la Canción y Metadatos */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/75 backdrop-blur-md p-4">
        <h1 className="text-xl font-black uppercase tracking-wider text-zinc-100">
          {song.title}
        </h1>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2.5">
            <Guitar className="h-4 w-4 text-violet-400 shrink-0" />
            <div>
              <span className="block text-[9px] uppercase tracking-widest text-zinc-500">
                Afinación
              </span>
              <input
                type="text"
                value={song.tuning}
                onChange={(e) => setSong({ ...song, tuning: e.target.value })}
                onBlur={(e) => {
                  if (!isSupabaseConfigured) {
                    syncLocalSong({ ...song, tuning: e.target.value });
                    return;
                  }
                  supabase
                    .from('songs')
                    .update({ tuning: e.target.value })
                    .eq('id', song.id);
                }}
                className="w-full bg-transparent font-mono text-xs font-bold text-zinc-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2.5">
            <Gauge className="h-4 w-4 text-emerald-400 shrink-0" />
            <div>
              <span className="block text-[9px] uppercase tracking-widest text-zinc-500">
                Tempo (BPM)
              </span>
              <input
                type="number"
                value={song.tempo}
                onChange={(e) =>
                  setSong({ ...song, tempo: Number(e.target.value) })
                }
                onBlur={(e) => {
                  if (!isSupabaseConfigured) {
                    syncLocalSong({ ...song, tempo: Number(e.target.value) });
                    return;
                  }
                  supabase
                    .from('songs')
                    .update({ tempo: Number(e.target.value) })
                    .eq('id', song.id);
                }}
                className="w-full bg-transparent font-mono text-xs font-bold text-zinc-100 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 1. Stem Tracker */}
      <StemTracker song={song} onUpdateStem={handleUpdateStem} />

      {/* 2. Editor de Letras + Botón Modo Teleprompter */}
      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/75 backdrop-blur-md p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-300">
              Letras & Estructuras Vocales
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveLyrics}
              disabled={savingLyrics}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-200 transition"
            >
              {savingLyrics ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isEditingLyrics ? (
                <Save className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              )}
              {isEditingLyrics ? 'Guardar Letra' : 'Sincronizado'}
            </button>

            <button
              type="button"
              onClick={() => setTeleprompterOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-emerald-950/60 transition"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Modo Teleprompter
            </button>
          </div>
        </div>

        <textarea
          rows={10}
          value={lyricsDraft}
          onFocus={() => setIsEditingLyrics(true)}
          onChange={(e) => {
            setIsEditingLyrics(true);
            setLyricsDraft(e.target.value);
          }}
          onBlur={handleSaveLyrics}
          placeholder="[INTRO] - [ESTRIBILLO]... &#10;Escribe o pega la letra aquí."
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/70 p-3.5 font-mono text-sm leading-relaxed text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
      </section>

      {/* 3. Subida de Audio, Reproductor y Comentarios con Timestamp */}
      <AudioSection songId={song.id} />

      {/* 4. Archivos de cualquier índole adjuntos a esta canción (Tabs GP, PDFs, Visuales, Presets) */}
      <FilesManager
        songId={song.id}
        sectionTitle="Archivos del Tema (Tablaturas GP, PDFs, Presets, Visuales)"
      />

      {/* 5. Modal Pantalla Completa: Modo Teleprompter */}
      <TeleprompterModal
        title={song.title}
        tuning={song.tuning}
        tempo={song.tempo}
        lyrics={lyricsDraft}
        isOpen={teleprompterOpen}
        onClose={() => setTeleprompterOpen(false)}
      />
    </div>
  );
}
