-- ============================================================================
-- ESQUEMA COMPLETO Y LIMPIO (RESET TOTAL) - METAL // STUDIO PWA
-- Borra datos de prueba previos y crea las 5 tablas, RLS, Realtime y 2 Buckets
-- ============================================================================

create extension if not exists "pgcrypto";

-- Limpieza previa para empezar desde cero sin canciones de prueba
drop table if exists public.audio_comments cascade;
drop table if exists public.audios cascade;
drop table if exists public.band_files cascade;
drop table if exists public.band_events cascade;
drop table if exists public.songs cascade;

do $$ begin
  create type song_status as enum ('idea', 'demo', 'finished');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stem_status as enum ('pending', 'in_progress', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type audio_type as enum ('riff', 'vocal_take', 'full_demo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_category as enum ('rehearsal', 'gig', 'studio', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type file_category as enum ('rider', 'logo_visual', 'tab_sheet', 'preset_stem', 'other');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- 1. TABLAS PRINCIPALES
-- ============================================================================

-- Tabla: songs
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tuning text not null default 'Drop C',
  tempo integer not null default 140,
  lyrics text default '',
  status song_status not null default 'idea',
  
  -- Stem Tracker
  drums_status stem_status not null default 'pending',
  bass_status stem_status not null default 'pending',
  rhythm_guitar_status stem_status not null default 'pending',
  lead_guitar_status stem_status not null default 'pending',
  clean_vocals_status stem_status not null default 'pending',
  harsh_vocals_status stem_status not null default 'pending',
  
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabla: audios
create table public.audios (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  title text not null,
  url text not null,
  type audio_type not null default 'riff',
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  uploader_email text,
  created_at timestamptz not null default now()
);

-- Tabla: audio_comments
create table public.audio_comments (
  id uuid primary key default gen_random_uuid(),
  audio_id uuid not null references public.audios(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  author_email text,
  timestamp_seconds integer not null check (timestamp_seconds >= 0),
  comment_text text not null,
  created_at timestamptz not null default now()
);

-- Tabla: band_events (Calendario compartido)
create table public.band_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  event_time text default '20:00',
  category event_category not null default 'rehearsal',
  location text default '',
  notes text default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  creator_email text,
  created_at timestamptz not null default now()
);

-- Tabla: band_files (Archivos generales si song_id es NULL, o adjuntos de canción)
create table public.band_files (
  id uuid primary key default gen_random_uuid(),
  song_id uuid references public.songs(id) on delete cascade,
  title text not null,
  file_name text not null,
  file_url text not null,
  file_size bigint not null default 0,
  mime_type text default 'application/octet-stream',
  category file_category not null default 'other',
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  uploader_email text,
  created_at timestamptz not null default now()
);

-- Índices
create index idx_audios_song_id on public.audios(song_id);
create index idx_audio_comments_audio_id on public.audio_comments(audio_id);
create index idx_audio_comments_timestamp on public.audio_comments(audio_id, timestamp_seconds asc);
create index idx_band_events_date on public.band_events(event_date asc);
create index idx_band_files_song_id on public.band_files(song_id);
create index idx_band_files_created_at on public.band_files(created_at desc);

-- Trigger updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_songs_updated_at
  before update on public.songs
  for each row
  execute function public.handle_updated_at();

-- ============================================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ============================================================================
alter table public.songs enable row level security;
alter table public.audios enable row level security;
alter table public.audio_comments enable row level security;
alter table public.band_events enable row level security;
alter table public.band_files enable row level security;

create policy "Acceso total canciones para banda" on public.songs
  for all to authenticated using (true) with check (true);

create policy "Acceso total audios para banda" on public.audios
  for all to authenticated using (true) with check (true);

create policy "Acceso total comentarios para banda" on public.audio_comments
  for all to authenticated using (true) with check (true);

create policy "Acceso total calendario para banda" on public.band_events
  for all to authenticated using (true) with check (true);

create policy "Acceso total archivos para banda" on public.band_files
  for all to authenticated using (true) with check (true);

-- ============================================================================
-- 3. SUPABASE REALTIME
-- ============================================================================
alter table public.songs replica identity full;
alter table public.audios replica identity full;
alter table public.audio_comments replica identity full;
alter table public.band_events replica identity full;
alter table public.band_files replica identity full;

do $$ begin alter publication supabase_realtime add table public.songs; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.audios; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.audio_comments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.band_events; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.band_files; exception when duplicate_object then null; end $$;

-- ============================================================================
-- 4. SUPABASE STORAGE (Buckets 'band-audios' y 'band-files')
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'band-audios',
  'band-audios',
  true,
  104857600,
  array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'band-files',
  'band-files',
  true,
  104857600,
  null
)
on conflict (id) do nothing;

drop policy if exists "Acceso storage band-audios" on storage.objects;
create policy "Acceso storage band-audios" on storage.objects
  for all to authenticated
  using (bucket_id = 'band-audios')
  with check (bucket_id = 'band-audios');

drop policy if exists "Acceso storage band-files" on storage.objects;
create policy "Acceso storage band-files" on storage.objects
  for all to authenticated
  using (bucket_id = 'band-files')
  with check (bucket_id = 'band-files');
