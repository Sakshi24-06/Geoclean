-- GeoClean Notifications & Status History Enhancements
-- Run in Supabase SQL Editor or migration runner

-- 1. Ensure waste_reports status check allows 'resolving' and 'deleted'
do $$
begin
  alter table public.waste_reports drop constraint if exists waste_reports_status_check;
  alter table public.waste_reports add constraint waste_reports_status_check 
    check (status in ('submitted', 'available', 'assigned', 'in_progress', 'resolving', 'resolved', 'released', 'deleted'));
exception
  when others then null;
end $$;

-- 2. Add deleted columns to waste_reports if not present
alter table public.waste_reports add column if not exists deleted boolean default false;
alter table public.waste_reports add column if not exists deleted_at timestamptz;
alter table public.waste_reports add column if not exists deleted_by uuid references public.profiles(id);
alter table public.waste_reports add column if not exists deletion_reason text;

-- 3. Enhance public.notifications table
alter table public.notifications add column if not exists is_read boolean default false;
alter table public.notifications add column if not exists read boolean default false;
alter table public.notifications add column if not exists type text;
alter table public.notifications add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.notifications add column if not exists report_code text;

-- Fix/add RLS policies on public.notifications
create policy "notifications select policy" on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy "notifications update policy" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notifications insert policy" on public.notifications
  for insert to authenticated with check (true);

create policy "notifications delete policy" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- 4. Create public.report_status_history table
create table if not exists public.report_status_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.waste_reports(id) on delete cascade,
  report_code text,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id),
  changed_by_name text,
  changed_by_role text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.report_status_history enable row level security;

create policy "report_status_history select policy" on public.report_status_history
  for select to authenticated using (true);

create policy "report_status_history insert policy" on public.report_status_history
  for insert to authenticated with check (true);

-- 5. Enable Realtime on notifications and waste_reports if publications exist
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.waste_reports;
exception
  when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.report_status_history;
exception
  when others then null;
end $$;
