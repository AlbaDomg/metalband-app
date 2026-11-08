import { createClient } from '@supabase/supabase-js';
import { AudioComment, AudioTrack, Song } from '@/types/database';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured =
  Boolean(rawUrl && rawKey) &&
  !rawUrl.includes('tu-proyecto.supabase.co') &&
  rawUrl.startsWith('http');

export const supabase = createClient(
  isSupabaseConfigured ? rawUrl : 'https://placeholder-project.supabase.co',
  isSupabaseConfigured ? rawKey : 'placeholder-anon-key',
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// ============================================================================
// DATOS DEMO INICIALES (Modo Local en Tiempo Real entre pestañas si aún no hay Supabase)
// ============================================================================
export const INITIAL_DEMO_SONGS: Song[] = [
  {
    id: 'demo-song-1',
    title: 'Abyssal Architecture',
    tuning: 'Drop F#',
    tempo: 145,
    status: 'demo',
    drums_status: 'done',
    bass_status: 'done',
    rhythm_guitar_status: 'done',
    lead_guitar_status: 'in_progress',
    clean_vocals_status: 'in_progress',
    harsh_vocals_status: 'done',
    lyrics: `[INTRO - AMBIENT + LOW GROWLS]
Beneath the weight of fractured glass
We carve our names in obsidian

[VERSE 1 - HARSH VOCALS]
Static pulses through the iron veins
No light remains inside the hollow frame
Collapse the sky!
BREATHE THE ASH!

[CHORUS - CLEAN VOCALS]
Carry me across the undertow
Where the crimson rivers freeze and glow
We are the silence after the storm

[BREAKDOWN - TEMPO DROP 95 BPM - GUTURAL PROFUNDO]
SINK!
INTO THE VOID!
NO REDEMPTION BELOW!`,
    created_by: 'local-member',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-song-2',
    title: 'Obsidian Spire (Bleed Out)',
    tuning: 'Drop C',
    tempo: 175,
    status: 'idea',
    drums_status: 'in_progress',
    bass_status: 'pending',
    rhythm_guitar_status: 'done',
    lead_guitar_status: 'pending',
    clean_vocals_status: 'pending',
    harsh_vocals_status: 'in_progress',
    lyrics: `[RIFF PRINCIPAL - TREMOLO PICKING + BLAST BEAT]
Silhouettes against the furnace wall
Wait for the hammer to fall

[PRE-BREAKDOWN - HIGH SCREAM]
Tear the roots from the stone!`,
    created_by: 'local-member',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const INITIAL_DEMO_AUDIOS: Record<string, AudioTrack[]> = {
  'demo-song-1': [
    {
      id: 'demo-audio-1',
      song_id: 'demo-song-1',
      title: 'Pre-Prod Full Mix v3 (Con Click)',
      // Audio WAV sintetizado ligero en Data URI para probar el reproductor y saltos de tiempo al instante
      url: 'https://actions.google.com/sounds/v1/ambiences/industrial_hum.ogg',
      type: 'full_demo',
      uploaded_by: 'local-member',
      uploader_email: 'guitarra@abyss.metal',
      created_at: new Date().toISOString(),
    },
  ],
};

export const INITIAL_DEMO_COMMENTS: Record<string, AudioComment[]> = {
  'demo-audio-1': [
    {
      id: 'demo-comment-1',
      audio_id: 'demo-audio-1',
      user_id: 'local-member',
      author_email: 'vocalista',
      timestamp_seconds: 4,
      comment_text: 'Aquí entra el gutural doblado con octavador grave',
      created_at: new Date().toISOString(),
    },
    {
      id: 'demo-comment-2',
      audio_id: 'demo-audio-1',
      user_id: 'local-member',
      author_email: 'bateria',
      timestamp_seconds: 12,
      comment_text: 'Cambiar el china a contratiempo con el chug de 8 cuerdas',
      created_at: new Date().toISOString(),
    },
  ],
};
