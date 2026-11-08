'use client';

import { useEffect, useState } from 'react';
import { Loader2, Radio, WifiOff } from 'lucide-react';

export type SyncState = 'connecting' | 'online' | 'error' | 'offline';

interface RealtimeStatusBadgeProps {
  channelStatus: 'connecting' | 'subscribed' | 'error';
}

export default function RealtimeStatusBadge({
  channelStatus,
}: RealtimeStatusBadgeProps) {
  const [isBrowserOnline, setIsBrowserOnline] = useState(true);

  useEffect(() => {
    setIsBrowserOnline(
      typeof navigator !== 'undefined' ? navigator.onLine : true
    );

    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => setIsBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isBrowserOnline) {
    return (
      <span
        title="Sin conexión a internet en el dispositivo"
        className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-rose-700/80 bg-rose-950/70 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-rose-300"
      >
        <WifiOff className="h-2.5 w-2.5 text-rose-400 shrink-0" />
        OFFLINE
      </span>
    );
  }

  if (channelStatus === 'error') {
    return (
      <span
        title="Error de conexión con el servidor en tiempo real"
        className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-rose-700/80 bg-rose-950/70 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-rose-300"
      >
        <WifiOff className="h-2.5 w-2.5 text-rose-400 shrink-0" />
        SYNC ERROR
      </span>
    );
  }

  if (channelStatus === 'connecting') {
    return (
      <span
        title="Conectando canal en tiempo real..."
        className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-amber-800/70 bg-amber-950/50 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-300"
      >
        <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-400 shrink-0" />
        SYNCING...
      </span>
    );
  }

  return (
    <span
      title="Sincronización en vivo activa con toda la banda"
      className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-emerald-900/50 bg-emerald-950/30 px-2 py-0.5 text-[8px] sm:text-[9px] font-medium uppercase tracking-wider text-emerald-400/85"
    >
      <Radio className="h-2 w-2 animate-pulse shrink-0" />
      LIVE SYNC
    </span>
  );
}

