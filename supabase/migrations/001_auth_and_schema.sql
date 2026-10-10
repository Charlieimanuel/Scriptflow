-- ==============================================================================
-- ScriptFlow AI — Skema Database & Autentikasi Supabase
-- Eksekusi skrip ini di SQL Editor dashboard Supabase Anda.
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

-- 2. TABEL PROFIL PENGGUNA (Tersinkronisasi otomatis dengan auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  role text not null default 'Line Producer',
  provider text not null default 'email', -- 'google' atau 'email'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS Profil
alter table public.profiles enable row level security;

create policy "Profil dapat dibaca oleh pengguna yang login"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Pengguna dapat mengupdate profil sendiri"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Sistem dapat membuat profil baru"
  on public.profiles for insert
  with check (true);

-- 3. TRIGGER OTOMATIS: Saat user daftar via Google / Email, salin ke public.profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_name text;
  user_avatar text;
  auth_provider text;
begin
  -- Ekstrak metadata nama dari OAuth Google atau form pendaftaran
  user_name := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );
  
  -- Ekstrak avatar jika ada (misal dari Google profile picture)
  user_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    null
  );

  -- Deteksi provider autentikasi
  auth_provider := coalesce(
    new.raw_app_meta_data->>'provider',
    case when new.raw_user_meta_data->>'iss' like '%google%' then 'google' else 'email' end,
    'email'
  );

  insert into public.profiles (id, email, name, avatar_url, provider)
  values (new.id, new.email, user_name, user_avatar, auth_provider)
  on conflict (id) do update
  set
    email = excluded.email,
    name = coalesce(public.profiles.name, excluded.name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

  return new;
end;
$$;

-- Trigger pada tabel auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. TABEL PROYEK (Terkoneksi ke User/Owner)
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  format text not null check (format in ('film_pendek','teater','serial_web','konten')),
  script_text text not null default '',
  contingency_pct numeric not null default 10,
  overrides jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Pengguna hanya dapat mengelola proyek miliknya"
  on public.projects for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 5. TABEL ADEGAN (SCENES)
create table if not exists public.scenes (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scene_no int not null,
  heading text not null,
  int_ext text,
  location text,
  time_of_day text,
  body text not null,
  content_hash text not null,
  analyzed_at timestamptz,
  unique (project_id, scene_no)
);

alter table public.scenes enable row level security;

create policy "Akses adegan sesuai pemilik proyek"
  on public.scenes for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

-- 6. TABEL ELEMEN PRODUKSI (SCENE ELEMENTS)
do $$ begin
  create type element_category as enum
    ('cast','prop','costume','location','lighting','sound','makeup','other');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.scene_elements (
  id uuid primary key default uuid_generate_v4(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  category element_category not null,
  name text not null,
  quantity int not null default 1,
  notes text,
  unit_price_override numeric,
  created_at timestamptz not null default now()
);

alter table public.scene_elements enable row level security;

create policy "Akses elemen sesuai pemilik proyek"
  on public.scene_elements for all
  using (exists (
    select 1 from public.scenes s
    join public.projects p on p.id = s.project_id
    where s.id = scene_id and p.owner_id = auth.uid()
  ));

-- 7. TABEL JADWAL SYUTING (SHOOTING DAYS)
create table if not exists public.shooting_days (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  day_no int not null,
  location text,
  scene_ids uuid[] not null default '{}',
  unique (project_id, day_no)
);

alter table public.shooting_days enable row level security;

create policy "Akses jadwal sesuai pemilik proyek"
  on public.shooting_days for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

-- 8. MASTER HARGA LOKAL & FUZZY MATCH
create table if not exists public.price_master (
  id uuid primary key default uuid_generate_v4(),
  category element_category not null,
  name text not null,
  unit text not null,
  unit_price numeric not null,
  region text not null default 'Surabaya',
  keywords text[] not null default '{}'
);

create index if not exists price_master_name_trgm on public.price_master using gin (name gin_trgm_ops);

alter table public.price_master enable row level security;
create policy "Master harga dapat dibaca oleh pengguna login"
  on public.price_master for select
  using (auth.role() = 'authenticated');

-- 9. HAK AKSES PERMISSIONS (AUTHENTICATED)
grant all on table public.profiles to authenticated;
grant all on table public.projects to authenticated;
grant all on table public.scenes to authenticated;
grant all on table public.scene_elements to authenticated;
grant all on table public.shooting_days to authenticated;
grant all on table public.price_master to authenticated;
grant usage, select on all sequences in schema public to authenticated;
