-- ============================================================================
-- MIGRACIÓN: CALENDARIO COMPARTIDO + ARCHIVOS DE LA BANDA Y POR CANCIÓN
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- ============================================================================

do $$ begin
  create type event_category as enum ('rehearsal', 'gig', 'studio', 'other');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type file_category as enum ('rider', 'logo_visual', 'tab_sheet', 'preset_stem', 'other');
exception
  when duplicate_object then null;
end $$;

-- 1. Tabla: band_events (Calendario compartido en tiempo real)
create table if not exists public.band_events (
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

create index if not exists idx_band_events_date on public.band_events(event_date asc);

-- 2. Tabla: band_files (Archivos generales de la banda y adjuntos por canción)
-- Si song_id es NULL -> Archivo general (Rider técnico, Logos, Stage Plot, Backdrops)
-- Si song_id tiene valor -> Archivo adjunto a esa canción (Tablaturas GP, Presets, PDFs, Visuales)
create table if not exists public.band_files (
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

create index if not exists idx_band_files_song_id on public.band_files(song_id);
create index if not exists idx_band_files_created_at on public.band_files(created_at desc);

-- 3. Row Level Security (RLS)
alter table public.band_events enable row level security;
alter table public.band_files enable row level security;

drop policy if exists "Miembros autenticados pueden ver todos los eventos" on public.band_events;
create policy "Miembros autenticados pueden ver todos los eventos"
  on public.band_events for select to authenticated using (true);

drop policy if exists "Miembros autenticados pueden crear eventos" on public.band_events;
create policy "Miembros autenticados pueden crear eventos"
  on public.band_events for insert to authenticated with check (true);

drop policy if exists "Miembros autenticados pueden editar eventos" on public.band_events;
create policy "Miembros autenticados pueden editar eventos"
  on public.band_events for update to authenticated using (true) with check (true);

drop policy if exists "Miembros autenticados pueden eliminar eventos" on public.band_events;
create policy "Miembros autenticados pueden eliminar eventos"
  on public.band_events for delete to authenticated using (true);

drop policy if exists "Miembros autenticados pueden ver todos los archivos" on public.band_files;
create policy "Miembros autenticados pueden ver todos los archivos"
  on public.band_files for select to authenticated using (true);

drop policy if exists "Miembros autenticados pueden subir archivos" on public.band_files;
create policy "Miembros autenticados pueden subir archivos"
  on public.band_files for insert to authenticated with check (true);

drop policy if exists "Miembros autenticados pueden editar archivos" on public.band_files;
create policy "Miembros autenticados pueden editar archivos"
  on public.band_files for update to authenticated using (true) with check (true);

drop policy if exists "Miembros autenticados pueden eliminar archivos" on public.band_files;
create policy "Miembros autenticados pueden eliminar archivos"
  on public.band_files for delete to authenticated using (true);

-- 4. Supabase Realtime para eventos y archivos
alter table public.band_events replica identity full;
alter table public.band_files replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.band_events;
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.band_files;
exception
  when duplicate_object then null;
end $$;

-- 5. Bucket 'band-files' en Supabase Storage (acepta cualquier formato: PDF, PNG, ZIP, GP, MP4, etc.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'band-files',
  'band-files',
  true,
  104857600, -- 100 MB por archivo
  null       -- Cualquier tipo de archivo permitido
)
on conflict (id) do nothing;

drop policy if exists "Miembros autenticados pueden leer band-files" on storage.objects;
create policy "Miembros autenticados pueden leer band-files"
  on storage.objects for select to authenticated
  using (bucket_id = 'band-files');

drop policy if exists "Miembros autenticados pueden subir a band-files" on storage.objects;
create policy "Miembros autenticados pueden subir a band-files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'band-files');

drop policy if exists "Miembros autenticados pueden actualizar en band-files" on storage.objects;
create policy "Miembros autenticados pueden actualizar en band-files"
  on storage.objects for update to authenticated
  using (bucket_id = 'band-files')
  with check (bucket_id = 'band-files');

drop policy if exists "Miembros autenticados pueden borrar de band-files" on storage.objects;
create policy "Miembros autenticados pueden borrar de band-files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'band-files');

