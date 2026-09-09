-- GeoClean NGO Directory & Permissions Safe Migration
-- Ensures proper RLS permissions and trigger fields for NGO registration & directory

-- 1. Ensure columns exist on public.ngos
alter table public.ngos add column if not exists description text;
alter table public.ngos add column if not exists website text;
alter table public.ngos add column if not exists services text;

-- 2. Trigger for user & NGO registration
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, mobile_number, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'ngo_name', new.email),
    new.email,
    new.raw_user_meta_data->>'mobile_number',
    coalesce(new.raw_user_meta_data->>'role', 'user')
  ) on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    mobile_number = coalesce(excluded.mobile_number, public.profiles.mobile_number),
    role = coalesce(excluded.role, public.profiles.role);

  if coalesce(new.raw_user_meta_data->>'role', 'user') = 'ngo' then
    insert into public.ngos (profile_id, ngo_name, address, latitude, longitude, mobile_number, description, website, services)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'ngo_name', new.raw_user_meta_data->>'full_name', new.email),
      coalesce(new.raw_user_meta_data->>'address', 'Pune, Maharashtra'),
      nullif(new.raw_user_meta_data->>'latitude', '')::double precision,
      nullif(new.raw_user_meta_data->>'longitude', '')::double precision,
      new.raw_user_meta_data->>'mobile_number',
      coalesce(new.raw_user_meta_data->>'description', 'Authorized GeoClean cleanup partner in Pune.'),
      new.raw_user_meta_data->>'website',
      coalesce(new.raw_user_meta_data->>'services', 'Waste Management, Community Cleanup')
    ) on conflict (profile_id) do update set
      ngo_name = coalesce(excluded.ngo_name, public.ngos.ngo_name),
      address = coalesce(excluded.address, public.ngos.address),
      latitude = coalesce(excluded.latitude, public.ngos.latitude),
      longitude = coalesce(excluded.longitude, public.ngos.longitude),
      mobile_number = coalesce(excluded.mobile_number, public.ngos.mobile_number),
      description = coalesce(excluded.description, public.ngos.description),
      website = coalesce(excluded.website, public.ngos.website),
      services = coalesce(excluded.services, public.ngos.services);
  end if;
  return new;
end;
$$;

-- 3. Update RLS policies
drop policy if exists "ngos readable by signed in users" on public.ngos;
drop policy if exists "ngos readable by all" on public.ngos;
create policy "ngos readable by all" on public.ngos for select using (true);

drop policy if exists "ngos self update" on public.ngos;
create policy "ngos self update" on public.ngos for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "ngos self insert" on public.ngos;
create policy "ngos self insert" on public.ngos for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists "profiles readable by signed in users" on public.profiles;
drop policy if exists "profiles readable by all" on public.profiles;
create policy "profiles readable by all" on public.profiles for select using (true);

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles for insert to authenticated with check (id = auth.uid());
