-- GeoClean NGO workflow. Run this once in the Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  mobile_number text,
  role text not null check (role in ('user', 'ngo', 'admin')),
  created_at timestamptz not null default now()
);

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

create table if not exists public.waste_reports (
  id uuid primary key default gen_random_uuid(),
  report_code text not null unique,
  user_id uuid not null references public.profiles(id),
  title text not null,
  description text,
  waste_type text not null,
  address text not null,
  latitude double precision,
  longitude double precision,
  status text not null default 'available' check (status in ('submitted','available','assigned','in_progress','resolved','released')),
  assigned_ngo_id uuid references public.ngos(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.ngos(id)
);

create table if not exists public.report_images (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.waste_reports(id) on delete cascade,
  image_url text not null,
  image_type text not null check (image_type in ('before','after')),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (report_id, image_type)
);

create table if not exists public.ngo_assignments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.waste_reports(id) on delete cascade,
  ngo_id uuid not null references public.ngos(id),
  status text not null check (status in ('accepted','released')),
  accepted_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  unique (report_id, ngo_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid references public.waste_reports(id) on delete cascade,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, mobile_number, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email,
          new.raw_user_meta_data->>'mobile_number', coalesce(new.raw_user_meta_data->>'role', 'user'))
  on conflict (id) do nothing;
  if coalesce(new.raw_user_meta_data->>'role', 'user') = 'ngo' then
    insert into public.ngos (profile_id, ngo_name, address, latitude, longitude, mobile_number)
    values (new.id, coalesce(new.raw_user_meta_data->>'ngo_name', new.email),
            coalesce(new.raw_user_meta_data->>'address', 'Service area not set'),
            nullif(new.raw_user_meta_data->>'latitude', '')::double precision,
            nullif(new.raw_user_meta_data->>'longitude', '')::double precision,
            new.raw_user_meta_data->>'mobile_number')
    on conflict (profile_id) do nothing;
  end if;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.set_report_fields() returns trigger language plpgsql as $$
begin
  if new.report_code is null or new.report_code = '' then new.report_code := 'GC-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(new.id::text, '-', ''), 1, 6)); end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists set_report_fields on public.waste_reports;
create trigger set_report_fields before insert or update on public.waste_reports for each row execute procedure public.set_report_fields();

create or replace function public.current_ngo_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from public.ngos where profile_id = auth.uid()
$$;

create or replace function public.is_nearby_report(p_report public.waste_reports) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ngos n
    where n.profile_id = auth.uid() and p_report.latitude is not null and p_report.longitude is not null
      and n.latitude is not null and n.longitude is not null
      and 6371 * acos(least(1, greatest(-1, cos(radians(n.latitude)) * cos(radians(p_report.latitude)) * cos(radians(p_report.longitude) - radians(n.longitude)) + sin(radians(n.latitude)) * sin(radians(p_report.latitude))))) <= 25
  )
$$;

-- Notify each eligible NGO when a citizen posts a geo-located report.
create or replace function public.notify_nearby_ngos() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.latitude is not null and new.longitude is not null then
    insert into public.notifications (user_id, report_id, title, message)
    select n.profile_id, new.id, 'New nearby report available', 'Report ' || new.report_code || ' is available in your service area.'
    from public.ngos n
    where n.latitude is not null and n.longitude is not null
      and 6371 * acos(least(1, greatest(-1, cos(radians(n.latitude)) * cos(radians(new.latitude)) * cos(radians(new.longitude) - radians(n.longitude)) + sin(radians(n.latitude)) * sin(radians(new.latitude))))) <= 25;
  end if;
  return new;
end; $$;
drop trigger if exists notify_nearby_ngos on public.waste_reports;
create trigger notify_nearby_ngos after insert on public.waste_reports for each row execute procedure public.notify_nearby_ngos();

-- Atomically assigns only an available nearby report. The FOR UPDATE lock makes first accept win.
create or replace function public.accept_nearby_report(p_report_id uuid) returns public.waste_reports language plpgsql security definer set search_path = public as $$
declare v_ngo uuid; v_report public.waste_reports;
begin
  select public.current_ngo_id() into v_ngo;
  if v_ngo is null then raise exception 'NGO account required'; end if;
  select * into v_report from public.waste_reports where id = p_report_id for update;
  if not found then raise exception 'Report not found'; end if;
  if not public.is_nearby_report(v_report) then raise exception 'Report is not in your service area'; end if;
  if v_report.assigned_ngo_id is not null or v_report.status not in ('available','released') then raise exception 'This report has already been assigned'; end if;
  if exists (select 1 from public.ngo_assignments where report_id = p_report_id and ngo_id = v_ngo and status = 'released') then raise exception 'Your NGO released this report and cannot accept it again'; end if;
  update public.waste_reports set assigned_ngo_id = v_ngo, status = 'assigned' where id = p_report_id returning * into v_report;
  insert into public.ngo_assignments (report_id, ngo_id, status, accepted_at) values (p_report_id, v_ngo, 'accepted', now())
    on conflict (report_id, ngo_id) do update set status = 'accepted', accepted_at = now(), rejected_at = null, rejection_reason = null;
  insert into public.notifications (user_id, report_id, title, message) select profile_id, p_report_id, 'Report assigned to your NGO', 'Your organization accepted report ' || v_report.report_code from public.ngos where id = v_ngo;
  return v_report;
end; $$;

create or replace function public.release_assigned_report(p_report_id uuid, p_reason text default null) returns public.waste_reports language plpgsql security definer set search_path = public as $$
declare v_ngo uuid; v_report public.waste_reports;
begin
  select public.current_ngo_id() into v_ngo;
  select * into v_report from public.waste_reports where id = p_report_id for update;
  if v_report.assigned_ngo_id is distinct from v_ngo then raise exception 'Only the assigned NGO can release this report'; end if;
  update public.waste_reports set assigned_ngo_id = null, status = 'released' where id = p_report_id returning * into v_report;
  update public.ngo_assignments set status = 'released', rejected_at = now(), rejection_reason = nullif(trim(p_reason), '') where report_id = p_report_id and ngo_id = v_ngo;
  return v_report;
end; $$;

create or replace function public.update_assigned_report_status(p_report_id uuid, p_status text) returns public.waste_reports language plpgsql security definer set search_path = public as $$
declare v_ngo uuid; v_report public.waste_reports;
begin
  select public.current_ngo_id() into v_ngo;
  select * into v_report from public.waste_reports where id = p_report_id for update;
  if v_report.assigned_ngo_id is distinct from v_ngo then raise exception 'Only the assigned NGO can update this report'; end if;
  if p_status = 'in_progress' and v_report.status = 'assigned' then update public.waste_reports set status = 'in_progress' where id = p_report_id returning * into v_report;
  elsif p_status = 'resolved' and v_report.status = 'in_progress' and exists (select 1 from public.report_images where report_id = p_report_id and image_type = 'after') then update public.waste_reports set status = 'resolved', resolved_by = v_ngo, resolved_at = now() where id = p_report_id returning * into v_report;
  else raise exception 'Invalid status transition or after-cleaning photo missing'; end if;
  return v_report;
end; $$;

alter table public.profiles enable row level security; alter table public.ngos enable row level security; alter table public.waste_reports enable row level security; alter table public.report_images enable row level security; alter table public.ngo_assignments enable row level security; alter table public.notifications enable row level security;
create policy "profiles readable by signed in users" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "ngos readable by signed in users" on public.ngos for select to authenticated using (true);
create policy "ngos self update" on public.ngos for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "citizens create own reports" on public.waste_reports for insert to authenticated with check (user_id = auth.uid());
create policy "report visibility" on public.waste_reports for select to authenticated using (user_id = auth.uid() or assigned_ngo_id = public.current_ngo_id() or public.is_nearby_report(waste_reports));
create policy "citizens read report images" on public.report_images for select to authenticated using (exists (select 1 from public.waste_reports r where r.id = report_id and (r.user_id = auth.uid() or r.assigned_ngo_id = public.current_ngo_id() or public.is_nearby_report(r))));
create policy "citizen upload before" on public.report_images for insert to authenticated with check (image_type = 'before' and uploaded_by = auth.uid() and exists (select 1 from public.waste_reports r where r.id = report_id and r.user_id = auth.uid()));
create policy "ngo upload after" on public.report_images for insert to authenticated with check (image_type = 'after' and uploaded_by = auth.uid() and exists (select 1 from public.waste_reports r where r.id = report_id and r.assigned_ngo_id = public.current_ngo_id()));
create policy "assignment visibility" on public.ngo_assignments for select to authenticated using (ngo_id = public.current_ngo_id());
create policy "notification owner access" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notification owner update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public) values ('report-images', 'report-images', false) on conflict (id) do nothing;
create policy "report image read" on storage.objects for select to authenticated using (bucket_id = 'report-images');
create policy "report image upload to own folder" on storage.objects for insert to authenticated with check (bucket_id = 'report-images' and (storage.foldername(name))[1] = auth.uid()::text);
grant execute on function public.accept_nearby_report(uuid), public.release_assigned_report(uuid, text), public.update_assigned_report_status(uuid, text) to authenticated;
