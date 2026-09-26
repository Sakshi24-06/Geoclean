-- GeoClean: Complete Fix for Registration, Profiles, NGOs, RLS & Trigger Safety
-- Run this script in the Supabase SQL Editor to ensure all registration RLS policies, tables, and triggers are configured.

-- 1. Ensure required columns on public.profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  mobile_number text,
  role text not null check (role in ('user', 'ngo', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists mobile_number text;
alter table public.profiles add column if not exists area text;
alter table public.profiles add column if not exists locality text;
alter table public.profiles add column if not exists landmark text;
alter table public.profiles add column if not exists street text;
alter table public.profiles add column if not exists district text;
alter table public.profiles add column if not exists state text;
alter table public.profiles add column if not exists pincode text;
alter table public.profiles add column if not exists avatar_url text;

-- 2. Ensure required columns on public.ngos
create table if not exists public.ngos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  ngo_name text not null,
  address text not null,
  latitude double precision,
  longitude double precision,
  mobile_number text,
  description text,
  website text,
  services text,
  created_at timestamptz not null default now()
);

alter table public.ngos add column if not exists description text;
alter table public.ngos add column if not exists website text;
alter table public.ngos add column if not exists services text;
alter table public.ngos add column if not exists latitude double precision;
alter table public.ngos add column if not exists longitude double precision;
alter table public.ngos add column if not exists mobile_number text;

-- 3. Row Level Security on public.profiles
alter table public.profiles enable row level security;

drop policy if exists "profiles readable by signed in users" on public.profiles;
drop policy if exists "profiles readable by all" on public.profiles;
create policy "profiles readable by all" on public.profiles
  for select using (true);

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 4. Row Level Security on public.ngos
alter table public.ngos enable row level security;

drop policy if exists "ngos readable by signed in users" on public.ngos;
drop policy if exists "ngos readable by all" on public.ngos;
create policy "ngos readable by all" on public.ngos
  for select using (true);

drop policy if exists "ngos self insert" on public.ngos;
create policy "ngos self insert" on public.ngos
  for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "ngos self update" on public.ngos;
create policy "ngos self update" on public.ngos
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- 5. Safe, idempotent trigger for new user creation in auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_name text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'user');
  if v_role not in ('user', 'ngo', 'admin') then
    v_role := 'user';
  end if;

  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'ngo_name'), ''),
    split_part(new.email, '@', 1),
    'Citizen'
  );

  insert into public.profiles (id, full_name, email, mobile_number, role)
  values (
    new.id,
    v_name,
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data->>'mobile_number'), ''),
    v_role
  )
  on conflict (id) do update set
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    mobile_number = coalesce(nullif(excluded.mobile_number, ''), public.profiles.mobile_number),
    role = coalesce(nullif(excluded.role, ''), public.profiles.role);

  if v_role = 'ngo' then
    insert into public.ngos (
      profile_id,
      ngo_name,
      address,
      latitude,
      longitude,
      mobile_number,
      description,
      website,
      services
    )
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data->>'ngo_name'), ''), v_name, 'NGO Partner'),
      coalesce(nullif(trim(new.raw_user_meta_data->>'address'), ''), 'Pune, Maharashtra'),
      nullif(new.raw_user_meta_data->>'latitude', '')::double precision,
      nullif(new.raw_user_meta_data->>'longitude', '')::double precision,
      nullif(trim(new.raw_user_meta_data->>'mobile_number'), ''),
      coalesce(nullif(trim(new.raw_user_meta_data->>'description'), ''), 'Authorized GeoClean cleanup partner in Pune.'),
      nullif(trim(new.raw_user_meta_data->>'website'), ''),
      coalesce(nullif(trim(new.raw_user_meta_data->>'services'), ''), 'Waste Management, Community Cleanup')
    )
    on conflict (profile_id) do update set
      ngo_name = coalesce(nullif(excluded.ngo_name, ''), public.ngos.ngo_name),
      address = coalesce(nullif(excluded.address, ''), public.ngos.address),
      latitude = coalesce(excluded.latitude, public.ngos.latitude),
      longitude = coalesce(excluded.longitude, public.ngos.longitude),
      mobile_number = coalesce(nullif(excluded.mobile_number, ''), public.ngos.mobile_number),
      description = coalesce(nullif(excluded.description, ''), public.ngos.description),
      website = coalesce(nullif(excluded.website, ''), public.ngos.website),
      services = coalesce(nullif(excluded.services, ''), public.ngos.services);
  end if;

  return new;
exception
  when others then
    -- Log warning internally but do not abort auth user creation
    raise warning 'handle_new_user error for user %: %', new.id, SQLERRM;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
