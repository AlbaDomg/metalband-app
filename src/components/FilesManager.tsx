'use client';

import { useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { BandFile, FileCategory } from '@/types/database';
import {
  CheckCircle2,
  Download,
  FileArchive,
  FileImage,
  FileText,
  FolderOpen,
  Loader2,
  Radio,
  Trash2,
  Upload,
} from 'lucide-react';

interface FilesManagerProps {
  /**
   * Si songId es null -> Archivos Generales de la Banda (Rider Técnico, Logos, Stage Plot, Backdrops)
   * Si songId tiene un UUID -> Archivos específicos de esa canción (Tablaturas GP, PDFs, Presets, Visuales)
   */
  songId: string | null;
  sectionTitle?: string;
}

const FILE_CATEGORY_META: Record<
  FileCategory,
  { label: string; badge: string }
> = {
  rider: {
    label: 'RIDER TÉCNICO / STAGE PLOT',
    badge: 'border-emerald-700/80 bg-emerald-950/60 text-emerald-300',
  },
  logo_visual: {
    label: 'LOGOS / BACKGROUND / VISUAL',
    badge: 'border-violet-800/80 bg-violet-950/60 text-violet-300',
  },
  tab_sheet: {
    label: 'TABLATURA / GUITAR PRO / PDF',
    badge: 'border-emerald-800/80 bg-emerald-950/60 text-emerald-300',
  },
  preset_stem: {
    label: 'PRESETS / MIDI / STEMS ZIP',
    badge: 'border-amber-800/80 bg-amber-950/60 text-amber-300',
  },
  other: {
    label: 'DOCUMENTO / OTRO',
    badge: 'border-zinc-700 bg-zinc-900 text-zinc-300',
  },
};

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesManager({
  songId,
  sectionTitle,
}: FilesManagerProps) {
  const [files, setFiles] = useState<BandFile[]>([]);
  const [activeFilter, setActiveFilter] = useState<FileCategory | 'all'>('all');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FileCategory>(
    songId ? 'tab_sheet' : 'rider'
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Estado barra de progreso
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const storageKey = songId ? `metal_files_${songId}` : 'metal_files_general';

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem(storageKey);
      if (saved) setFiles(JSON.parse(saved));
      return;
    }

    const fetchFiles = async () => {
      let query = supabase
        .from('band_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (songId) {
        query = query.eq('song_id', songId);
      } else {
        query = query.is('song_id', null);
      }

      const { data } = await query;
      if (data) setFiles(data as BandFile[]);
    };

    fetchFiles();

    const channelName = songId
      ? `realtime-files-song-${songId}`
      : 'realtime-files-general';

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'band_files',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const added = payload.new as BandFile;
            const matchesScope = songId
              ? added.song_id === songId
              : added.song_id === null;
            if (!matchesScope) return;
            setFiles((prev) =>
              prev.some((f) => f.id === added.id) ? prev : [added, ...prev]
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setFiles((prev) => prev.filter((f) => f.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [songId, storageKey]);

  const uploadToBucketWithProgress = async (
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
      const endpoint = `${supabaseUrl}/storage/v1/object/band-files/${filePath}`;

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
          setUploadStage(
            pct < 60
              ? 'Subiendo archivo al repositorio de la banda...'
              : 'Verificando integridad del archivo...'
          );
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

      xhr.onerror = () =>
        reject(new Error('Error de red durante la subida del archivo'));

      xhr.send(file);
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !title.trim()) return;

    setUploading(true);
    setUploadSuccess(false);
    setUploadProgress(3);
    setUploadedBytes(0);
    setTotalBytes(selectedFile.size);
    setUploadStage('Iniciando transferencia...');

    try {
      const folder = songId ? `songs/${songId}` : 'general';
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${folder}/${Date.now()}-${safeName}`;

      await uploadToBucketWithProgress(filePath, selectedFile);

      setUploadProgress(98);
      setUploadStage('Sincronizando con los dispositivos de la banda...');

      const {
        data: { publicUrl },
      } = supabase.storage.from('band-files').getPublicUrl(filePath);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: inserted, error: dbError } = await supabase
        .from('band_files')
        .insert({
          song_id: songId,
          title: title.trim(),
          file_name: selectedFile.name,
          file_url: publicUrl,
          file_size: selectedFile.size,
          mime_type: selectedFile.type || 'application/octet-stream',
          category,
          uploaded_by: user?.id ?? null,
          uploader_email: user?.email?.split('@')[0] ?? 'Miembro',
        })
        .select()
        .single();

      if (dbError) throw dbError;

      if (inserted) {
        const added = inserted as BandFile;
        setFiles((prev) =>
          prev.some((f) => f.id === added.id) ? prev : [added, ...prev]
        );
      }

      setUploadProgress(100);
      setUploadSuccess(true);
      setTitle('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadSuccess(false), 3500);
    } catch (err: any) {
      alert(
        err.message ||
          'Error al subir archivo. Asegúrate de haber ejecutado migration_calendar_and_files.sql en Supabase.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (file: BandFile) => {
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    if (isSupabaseConfigured) {
      await supabase.from('band_files').delete().eq('id', file.id);
    }
  };

  const visibleFiles =
    activeFilter === 'all'
      ? files
      : files.filter((f) => f.category === activeFilter);

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/75 backdrop-blur-md p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-300 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-emerald-400" />
          {sectionTitle ||
            (songId
              ? 'Archivos Adjuntos del Tema (Tabs, Presets, Visuales, PDF)'
              : 'Repositorio General de la Banda (Rider Técnico, Logos, Backdrops)')}
        </h3>
        <span className="text-[10px] font-mono text-zinc-500">
          Cualquier formato (PDF, PNG, ZIP, GP, MP4...)
        </span>
      </div>

      {/* Formulario de Subida con Barra de Progreso */}
      <form onSubmit={handleUpload} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input
            type="text"
            required
            disabled={uploading}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              songId
                ? 'Nombre (ej. Tab Guitar Pro v2 / Visual Intro)'
                : 'Nombre (ej. Rider Técnico 2026 / Logo Vectorial PNG)'
            }
            className="sm:col-span-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
          />
          <select
            value={category}
            disabled={uploading}
            onChange={(e) => setCategory(e.target.value as FileCategory)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
          >
            <option value="rider">Rider Técnico / Stage Plot</option>
            <option value="logo_visual">Logos / Background / Visual</option>
            <option value="tab_sheet">Tablatura / Guitar Pro / PDF</option>
            <option value="preset_stem">Presets / MIDI / Stems ZIP</option>
            <option value="other">Otro Archivo</option>
          </select>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            required
            disabled={uploading}
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="flex-1 text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:text-zinc-200 hover:file:bg-zinc-700 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-zinc-950 transition disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Subiendo {uploadProgress}%
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Subir Archivo
              </>
            )}
          </button>
        </div>

        {/* Barra de carga visual */}
        {uploading && (
          <div className="mt-2 rounded-xl border border-emerald-800/60 bg-zinc-900/90 p-3.5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="flex items-center gap-2 font-bold text-emerald-300">
                <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                {uploadStage}
              </span>
              <span className="font-mono text-xs font-extrabold text-zinc-100">
                {uploadProgress}%
              </span>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-950 border border-zinc-800 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-lime-400 transition-all duration-200 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-zinc-400">
              <span className="truncate max-w-[200px]">
                {selectedFile?.name}
              </span>
              <span>
                {formatFileSize(uploadedBytes)} / {formatFileSize(totalBytes)}
              </span>
            </div>
          </div>
        )}

        {!uploading && uploadSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>¡Archivo subido y disponible para toda la banda!</span>
          </div>
        )}
      </form>

      {/* Filtros rápidos por categoría */}
      {files.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 pt-2 border-t border-zinc-900">
          {(
            [
              ['all', 'Todos'],
              ['rider', 'Riders'],
              ['logo_visual', 'Logos & Visuales'],
              ['tab_sheet', 'Tabs & PDFs'],
              ['preset_stem', 'Presets & ZIP'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFilter(key)}
              className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shrink-0 transition ${
                activeFilter === key
                  ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Listado de Archivos */}
      {visibleFiles.length === 0 ? (
        <p className="text-xs text-zinc-500 py-2">
          No hay archivos subidos en esta sección todavía.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {visibleFiles.map((file) => {
            const meta =
              FILE_CATEGORY_META[file.category] || FILE_CATEGORY_META.other;
            const isImage = file.mime_type?.startsWith('image/');

            return (
              <div
                key={file.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3 hover:border-zinc-700 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isImage ? (
                    <img
                      src={file.file_url}
                      alt={file.title}
                      className="h-11 w-11 rounded-lg object-cover border border-zinc-800 shrink-0 bg-zinc-950"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-emerald-400">
                      {file.category === 'logo_visual' ? (
                        <FileImage className="h-5 w-5" />
                      ) : file.category === 'preset_stem' ? (
                        <FileArchive className="h-5 w-5" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                    </div>
                  )}

                  <div className="min-w-0">
                    <span
                      className={`inline-block rounded border px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider mb-1 ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                    <p className="text-xs font-extrabold text-zinc-100 truncate">
                      {file.title}
                    </p>
                    <p className="text-[10px] font-mono text-zinc-500 truncate">
                      {file.file_name} • {formatFileSize(file.file_size)} • por{' '}
                      {file.uploader_email || 'Miembro'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={file.file_name}
                    title="Abrir o Descargar"
                    className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-emerald-500 hover:border-emerald-400 px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-200 hover:text-zinc-950 transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Descargar</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDeleteFile(file)}
                    title="Eliminar archivo"
                    className="rounded-lg p-2 text-zinc-600 hover:bg-rose-950/50 hover:text-rose-400 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
