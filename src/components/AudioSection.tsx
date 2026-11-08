'use client';

import { useEffect, useRef, useState } from 'react';
import {
  INITIAL_DEMO_AUDIOS,
  INITIAL_DEMO_COMMENTS,
  isSupabaseConfigured,
  supabase,
} from '@/lib/supabase/client';
import { AudioComment, AudioTrack, AudioType } from '@/types/database';
import {
  CheckCircle2,
  Clock,
  FileAudio,
  Loader2,
  MessageSquarePlus,
  Pause,
  Play,
  Radio,
  Send,
  Upload,
} from 'lucide-react';

interface AudioSectionProps {
  songId: string;
}

const AUDIO_TYPE_LABEL: Record<AudioType, { label: string; badge: string }> = {
  riff: {
    label: 'RIFF / IDEA',
    badge: 'border-zinc-700 bg-zinc-900 text-zinc-300',
  },
  vocal_take: {
    label: 'TOMA VOCAL',
    badge: 'border-rose-800/80 bg-rose-950/60 text-rose-300',
  },
  full_demo: {
    label: 'FULL DEMO',
    badge: 'border-violet-800/80 bg-violet-950/60 text-violet-300',
  },
};

export function formatSeconds(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AudioSection({ songId }: AudioSectionProps) {
  const [audios, setAudios] = useState<AudioTrack[]>([]);
  const [activeAudio, setActiveAudio] = useState<AudioTrack | null>(null);
  const [comments, setComments] = useState<AudioComment[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Estados de subida y barra de progreso
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadStage, setUploadStage] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [audioTitle, setAudioTitle] = useState('');
  const [audioType, setAudioType] = useState<AudioType>('riff');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [commentText, setCommentText] = useState('');
  const [lockedTimestamp, setLockedTimestamp] = useState<number | null>(null);

  // 1. Cargar Audios de la canción y suscribirse en Tiempo Real
  useEffect(() => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem(`abyss_audios_${songId}`);
      const list: AudioTrack[] = saved
        ? JSON.parse(saved)
        : INITIAL_DEMO_AUDIOS[songId] || [];
      setAudios(list);
      if (list.length > 0) setActiveAudio(list[0]);

      const bc = new BroadcastChannel('abyss-realtime');
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'AUDIOS_UPDATED' && ev.data.songId === songId) {
          setAudios(ev.data.audios);
          setActiveAudio((curr) => curr ?? ev.data.audios[0] ?? null);
        }
      };
      return () => bc.close();
    }

    const fetchAudios = async () => {
      const { data } = await supabase
        .from('audios')
        .select('*')
        .eq('song_id', songId)
        .order('created_at', { ascending: false });

      if (data) {
        const list = data as AudioTrack[];
        setAudios(list);
        if (list.length > 0 && !activeAudio) {
          setActiveAudio(list[0]);
        }
      }
    };

    fetchAudios();

    const audioChannel = supabase
      .channel(`realtime-audios-${songId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audios',
          filter: `song_id=eq.${songId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const added = payload.new as AudioTrack;
            setAudios((prev) =>
              prev.some((a) => a.id === added.id) ? prev : [added, ...prev]
            );
            setActiveAudio((curr) => curr ?? added);
          } else if (payload.eventType === 'DELETE') {
            const removedId = payload.old.id;
            setAudios((prev) => prev.filter((a) => a.id !== removedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(audioChannel);
    };
  }, [songId]);

  // 2. Cargar Comentarios del Audio Activo y suscribirse en Tiempo Real
  useEffect(() => {
    if (!activeAudio) {
      setComments([]);
      return;
    }

    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem(`abyss_comments_${activeAudio.id}`);
      const list: AudioComment[] = saved
        ? JSON.parse(saved)
        : INITIAL_DEMO_COMMENTS[activeAudio.id] || [];
      setComments(list);

      const bc = new BroadcastChannel('abyss-realtime');
      bc.onmessage = (ev) => {
        if (
          ev.data?.type === 'COMMENTS_UPDATED' &&
          ev.data.audioId === activeAudio.id
        ) {
          setComments(ev.data.comments);
        }
      };
      return () => bc.close();
    }

    const fetchComments = async () => {
      const { data } = await supabase
        .from('audio_comments')
        .select('*')
        .eq('audio_id', activeAudio.id)
        .order('timestamp_seconds', { ascending: true });

      if (data) setComments(data as AudioComment[]);
    };

    fetchComments();

    const commentsChannel = supabase
      .channel(`realtime-comments-${activeAudio.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audio_comments',
          filter: `audio_id=eq.${activeAudio.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newComment = payload.new as AudioComment;
            setComments((prev) => {
              if (prev.some((c) => c.id === newComment.id)) return prev;
              return [...prev, newComment].sort(
                (a, b) => a.timestamp_seconds - b.timestamp_seconds
              );
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setComments((prev) => prev.filter((c) => c.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(commentsChannel);
    };
  }, [activeAudio?.id]);

  // Subida con progreso real byte a byte usando XMLHttpRequest hacia Supabase Storage
  const uploadFileWithProgress = async (
    filePath: string,
    file: File
  ): Promise<void> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const token = session?.access_token || supabaseAnonKey;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const endpoint = `${supabaseUrl}/storage/v1/object/band-audios/${filePath}`;

      xhr.open('POST', endpoint, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', supabaseAnonKey);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('cache-control', '3600');
      xhr.setRequestHeader(
        'Content-Type',
        file.type || 'application/octet-stream'
      );

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadedBytes(event.loaded);
          setTotalBytes(event.total);
          const pct = Math.min(
            95,
            Math.round((event.loaded / event.total) * 95)
          );
          setUploadProgress(pct);
          if (pct < 35) {
            setUploadStage('Subiendo ondas de audio al servidor...');
          } else if (pct < 80) {
            setUploadStage('Procesando pista sin compresión...');
          } else {
            setUploadStage('Finalizando subida al bucket...');
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          try {
            const errJson = JSON.parse(xhr.responseText);
            reject(
              new Error(
                errJson.message || errJson.error || `Error HTTP ${xhr.status}`
              )
            );
          } catch {
            reject(new Error(`Error al subir archivo (HTTP ${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Error de red durante la subida del audio'));
      };

      xhr.send(file);
    });
  };

  // Subida a Supabase Storage (o URL local en modo Demo)
  const handleUploadAudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !audioTitle.trim()) return;

    setUploading(true);
    setUploadSuccess(false);
    setUploadProgress(2);
    setUploadedBytes(0);
    setTotalBytes(selectedFile.size);
    setUploadStage('Preparando pista de audio...');

    try {
      if (!isSupabaseConfigured) {
        // Simulación visual rápida en modo local
        for (const p of [25, 60, 90, 100]) {
          await new Promise((r) => setTimeout(r, 180));
          setUploadProgress(p);
          setUploadedBytes(Math.round((selectedFile.size * p) / 100));
        }
        const localUrl = URL.createObjectURL(selectedFile);
        const newTrack: AudioTrack = {
          id: `local-audio-${Date.now()}`,
          song_id: songId,
          title: audioTitle.trim(),
          url: localUrl,
          type: audioType,
          uploaded_by: 'local-member',
          uploader_email: 'miembro@abyss.metal',
          created_at: new Date().toISOString(),
        };
        const next = [newTrack, ...audios];
        setAudios(next);
        setActiveAudio(newTrack);
        localStorage.setItem(`abyss_audios_${songId}`, JSON.stringify(next));
        const bc = new BroadcastChannel('abyss-realtime');
        bc.postMessage({ type: 'AUDIOS_UPDATED', songId, audios: next });
        bc.close();
        setAudioTitle('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const ext = selectedFile.name.split('.').pop() || 'mp3';
      const filePath = `${songId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;

      await uploadFileWithProgress(filePath, selectedFile);

      setUploadProgress(98);
      setUploadStage('Sincronizando en tiempo real con la banda...');

      const {
        data: { publicUrl },
      } = supabase.storage.from('band-audios').getPublicUrl(filePath);

      const { data: insertedTrack, error: dbError } = await supabase
        .from('audios')
        .insert({
          song_id: songId,
          title: audioTitle.trim(),
          url: publicUrl,
          type: audioType,
          uploaded_by: user?.id ?? null,
          uploader_email: user?.email ?? 'Miembro',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      if (insertedTrack) {
        const added = insertedTrack as AudioTrack;
        setAudios((prev) =>
          prev.some((a) => a.id === added.id) ? prev : [added, ...prev]
        );
        setActiveAudio(added);
      }

      setUploadProgress(100);
      setUploadStage('¡Pista subida y sincronizada!');
      setUploadSuccess(true);
      setAudioTitle('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Error al subir el archivo de audio');
    } finally {
      setUploading(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const seekToSecond = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    setCurrentTime(seconds);
    audioRef.current.play().catch(() => {});
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAudio || !commentText.trim()) return;

    const targetSecond =
      lockedTimestamp !== null ? lockedTimestamp : Math.floor(currentTime);

    if (!isSupabaseConfigured) {
      const newComment: AudioComment = {
        id: `local-comment-${Date.now()}`,
        audio_id: activeAudio.id,
        user_id: 'local-member',
        author_email: 'miembro',
        timestamp_seconds: targetSecond,
        comment_text: commentText.trim(),
        created_at: new Date().toISOString(),
      };
      const next = [...comments, newComment].sort(
        (a, b) => a.timestamp_seconds - b.timestamp_seconds
      );
      setComments(next);
      localStorage.setItem(
        `abyss_comments_${activeAudio.id}`,
        JSON.stringify(next)
      );
      const bc = new BroadcastChannel('abyss-realtime');
      bc.postMessage({
        type: 'COMMENTS_UPDATED',
        audioId: activeAudio.id,
        comments: next,
      });
      bc.close();
      setCommentText('');
      setLockedTimestamp(null);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('audio_comments').insert({
      audio_id: activeAudio.id,
      user_id: user?.id ?? null,
      author_email: user?.email?.split('@')[0] ?? 'Miembro',
      timestamp_seconds: targetSecond,
      comment_text: commentText.trim(),
    });

    if (!error) {
      setCommentText('');
      setLockedTimestamp(null);
    }
  };

  return (
    <section className="space-y-4">
      {/* Tarjeta de Subida de Audio */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-300 mb-3 flex items-center gap-2">
          <Upload className="h-4 w-4 text-rose-500" />
          Subir Pista / Maqueta (WAV, MP3, M4A)
        </h3>

        <form onSubmit={handleUploadAudio} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              required
              disabled={uploading}
              placeholder="Ej. Riff Breakdown v2"
              value={audioTitle}
              onChange={(e) => setAudioTitle(e.target.value)}
              className="sm:col-span-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:border-rose-700 focus:outline-none disabled:opacity-50"
            />
            <select
              value={audioType}
              disabled={uploading}
              onChange={(e) => setAudioType(e.target.value as AudioType)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 focus:border-rose-700 focus:outline-none disabled:opacity-50"
            >
              <option value="riff">Riff / Idea</option>
              <option value="vocal_take">Toma Vocal</option>
              <option value="full_demo">Full Demo</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.mp3,.m4a,audio/*"
              required
              disabled={uploading}
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="flex-1 text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:text-zinc-200 hover:file:bg-zinc-700 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="flex items-center justify-center gap-2 rounded-lg bg-rose-800 hover:bg-rose-700 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Subiendo {uploadProgress}%
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Subir Audio
                </>
              )}
            </button>
          </div>

          {/* Barra de Progreso Industrial en Tiempo Real durante la Subida */}
          {uploading && (
            <div className="mt-3 rounded-xl border border-rose-900/60 bg-zinc-900/90 p-3.5 shadow-inner">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="flex items-center gap-2 font-bold text-rose-300">
                  <Radio className="h-3.5 w-3.5 animate-pulse text-rose-500" />
                  {uploadStage}
                </span>
                <span className="font-mono text-xs font-extrabold text-zinc-100">
                  {uploadProgress}%
                </span>
              </div>

              {/* Barra animada */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-950 border border-zinc-800 p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-800 via-rose-500 to-violet-500 transition-all duration-200 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span className="truncate max-w-[200px]">
                  {selectedFile?.name}
                </span>
                <span>
                  {formatMegabytes(uploadedBytes)} /{' '}
                  {formatMegabytes(totalBytes)}
                </span>
              </div>
            </div>
          )}

          {/* Aviso de Subida Completada */}
          {!uploading && uploadSuccess && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                ¡Pista subida al estudio y sincronizada con toda la banda!
              </span>
            </div>
          )}
        </form>
      </div>

      {/* Lista de tomas + Reproductor + Comentarios con Timestamp */}
      {audios.length > 0 && (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4 space-y-4">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Archivos disponibles ({audios.length})
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {audios.map((track) => {
                const isSelected = activeAudio?.id === track.id;
                const badge = AUDIO_TYPE_LABEL[track.type];
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => {
                      setActiveAudio(track);
                      setIsPlaying(false);
                      setCurrentTime(0);
                    }}
                    className={`flex items-center gap-2 shrink-0 rounded-lg border px-3 py-2 text-left transition ${
                      isSelected
                        ? 'border-rose-600 bg-rose-950/40 text-white'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <FileAudio className="h-4 w-4 text-rose-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold leading-none">
                        {track.title}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded border px-1.5 py-0.2 text-[9px] font-bold uppercase ${badge.badge}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {activeAudio && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <audio
                ref={audioRef}
                src={activeAudio.url}
                onTimeUpdate={() =>
                  setCurrentTime(audioRef.current?.currentTime || 0)
                }
                onLoadedMetadata={() =>
                  setDuration(audioRef.current?.duration || 0)
                }
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-700 hover:bg-rose-600 text-white shadow-lg shadow-rose-950 transition active:scale-95"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-0.5" />
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-zinc-100">
                      {activeAudio.title}
                    </span>
                    <span className="font-mono text-rose-400">
                      {formatSeconds(currentTime)} / {formatSeconds(duration)}
                    </span>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.1}
                      value={currentTime}
                      onChange={(e) => seekToSecond(Number(e.target.value))}
                      className="w-full accent-rose-600 cursor-pointer h-2 bg-zinc-800 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <form onSubmit={handleAddComment} className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setLockedTimestamp(Math.floor(currentTime))}
                  className="flex items-center gap-1 rounded-lg border border-rose-800/70 bg-rose-950/50 px-2.5 py-2 font-mono text-xs font-bold text-rose-300 shrink-0"
                  title="Fijar segundo actual"
                >
                  <Clock className="h-3.5 w-3.5 text-rose-500" />
                  {formatSeconds(
                    lockedTimestamp !== null ? lockedTimestamp : currentTime
                  )}
                </button>

                <input
                  type="text"
                  placeholder="Comentar en este segundo (ej. Meter blast beat o doblar gutural)..."
                  value={commentText}
                  onFocus={() => {
                    if (lockedTimestamp === null) {
                      setLockedTimestamp(Math.floor(currentTime));
                    }
                  }}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-rose-700 focus:outline-none"
                />

                <button
                  type="submit"
                  className="flex items-center justify-center rounded-lg bg-rose-800 hover:bg-rose-700 px-3.5 py-2 text-white transition"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                  <MessageSquarePlus className="h-3.5 w-3.5 text-violet-400" />
                  Notas de Producción ({comments.length}) — Toca un comentario para saltar al segundo exacto
                </p>

                {comments.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-2">
                    Aún no hay comentarios en esta pista.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        onClick={() => seekToSecond(comment.timestamp_seconds)}
                        className="group flex items-start gap-2.5 rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-2.5 cursor-pointer hover:border-rose-700/70 hover:bg-zinc-900 transition"
                      >
                        <span className="inline-flex items-center gap-1 rounded bg-rose-950/80 border border-rose-800/70 px-2 py-0.5 font-mono text-xs font-bold text-rose-300 shrink-0 group-hover:bg-rose-700 group-hover:text-white transition">
                          <Play className="h-2.5 w-2.5 fill-current" />
                          {formatSeconds(comment.timestamp_seconds)}
                        </span>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-zinc-200 break-words">
                            {comment.comment_text}
                          </p>
                          <span className="text-[10px] text-zinc-500">
                            por {comment.author_email || 'Miembro'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
