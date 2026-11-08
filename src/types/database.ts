export type SongStatus = 'idea' | 'demo' | 'finished';
export type StemStatus = 'pending' | 'in_progress' | 'done';
export type AudioType = 'riff' | 'vocal_take' | 'full_demo';
export type EventCategory = 'rehearsal' | 'gig' | 'studio' | 'other';
export type FileCategory =
  | 'rider'
  | 'logo_visual'
  | 'tab_sheet'
  | 'preset_stem'
  | 'other';

export interface Song {
  id: string;
  title: string;
  tuning: string;
  tempo: number;
  lyrics: string;
  status: SongStatus;
  drums_status: StemStatus;
  bass_status: StemStatus;
  rhythm_guitar_status: StemStatus;
  lead_guitar_status: StemStatus;
  clean_vocals_status: StemStatus;
  harsh_vocals_status: StemStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AudioTrack {
  id: string;
  song_id: string;
  title: string;
  url: string;
  type: AudioType;
  uploaded_by: string | null;
  uploader_email: string | null;
  created_at: string;
}

export interface AudioComment {
  id: string;
  audio_id: string;
  user_id: string | null;
  author_email: string | null;
  timestamp_seconds: number;
  comment_text: string;
  created_at: string;
}

export interface BandEvent {
  id: string;
  title: string;
  event_date: string; // YYYY-MM-DD
  event_time: string; // HH:mm
  category: EventCategory;
  location: string;
  notes: string;
  created_by: string | null;
  creator_email: string | null;
  created_at: string;
}

export interface BandFile {
  id: string;
  song_id: string | null; // null = Archivo general de la banda (Rider, Logos, etc.)
  title: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  category: FileCategory;
  uploaded_by: string | null;
  uploader_email: string | null;
  created_at: string;
}

export type StemField =
  | 'drums_status'
  | 'bass_status'
  | 'rhythm_guitar_status'
  | 'lead_guitar_status'
  | 'clean_vocals_status'
  | 'harsh_vocals_status';
