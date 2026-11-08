'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Play,
  Pause,
  Gauge,
  Guitar,
  X,
} from 'lucide-react';

interface TeleprompterModalProps {
  title: string;
  tuning: string;
  tempo: number;
  lyrics: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function TeleprompterModal({
  title,
  tuning,
  tempo,
  lyrics,
  isOpen,
  onClose,
}: TeleprompterModalProps) {
  const [fontSize, setFontSize] = useState<'text-2xl' | 'text-4xl' | 'text-5xl'>('text-4xl');
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll || !isOpen) return;
    const interval = setInterval(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollBy({
          top: scrollSpeed,
          behavior: 'auto',
        });
      }
    }, 45);
    return () => clearInterval(interval);
  }, [autoScroll, scrollSpeed, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Barra de control superior fija de alto contraste */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-emerald-400 block">
            LIVE TELEPROMPTER MODE
          </span>
          <h2 className="text-base font-black uppercase tracking-wider text-white">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Metadatos visibles desde el pie de micro */}
          <div className="hidden sm:flex items-center gap-3 mr-3 text-xs font-mono text-zinc-300">
            <span className="flex items-center gap-1 rounded bg-zinc-900 px-2 py-1 border border-zinc-800">
              <Guitar className="h-3.5 w-3.5 text-violet-400" />
              {tuning}
            </span>
            <span className="flex items-center gap-1 rounded bg-zinc-900 px-2 py-1 border border-zinc-800">
              <Gauge className="h-3.5 w-3.5 text-emerald-400" />
              {tempo} BPM
            </span>
          </div>

          {/* Botón Auto-Scroll */}
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
              autoScroll
                ? 'border-emerald-500 bg-emerald-900/60 text-emerald-200'
                : 'border-zinc-800 bg-zinc-900 text-zinc-300'
            }`}
          >
            {autoScroll ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            Scroll
          </button>

          {/* Selector de tamaño de fuente */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900">
            <button
              type="button"
              onClick={() =>
                setFontSize((prev) =>
                  prev === 'text-5xl' ? 'text-4xl' : 'text-2xl'
                )
              }
              className="p-2 text-zinc-300 hover:text-white"
              title="Reducir letra"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setFontSize((prev) =>
                  prev === 'text-2xl' ? 'text-4xl' : 'text-5xl'
                )
              }
              className="p-2 text-zinc-300 hover:text-white border-l border-zinc-800"
              title="Aumentar letra"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Cerrar Teleprompter */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-xs font-black uppercase tracking-widest text-zinc-950"
          >
            <Minimize2 className="h-4 w-4" />
            Salir
          </button>
        </div>
      </div>

      {/* Cuerpo de la letra con contraste extremo para escenarios/locales oscuros */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-5 py-8 sm:px-12"
      >
        {lyrics.trim() ? (
          <pre
            className={`whitespace-pre-wrap break-words font-sans font-black uppercase leading-tight tracking-wide text-zinc-100 ${fontSize}`}
          >
            {lyrics}
          </pre>
        ) : (
          <p className="text-center text-xl font-bold uppercase tracking-widest text-zinc-600 mt-20">
            [ Sin letra registrada todavía ]
          </p>
        )}
        <div className="h-48" />
      </div>
    </div>
  );
}

