-- Secure Public Platform Statistics RPC
-- Returns real database aggregate counts for Citizens, Resolved cleanups, NGOs, and Total Reported issues.
-- Uses SECURITY DEFINER to bypass Row Level Security solely for aggregate integer counts.
-- Completely prevents exposing personal user data (emails, names, phone numbers, IDs) to the client.

create or replace function public.get_public_platform_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_citizens bigint;
  v_resolved bigint;
  v_ngos bigint;
  v_reported bigint;
  v_ngos_table bigint;
begin
  -- 1. Real Citizen count (profiles with role in ('user', 'citizen') or any non-ngo/non-admin user)
  select count(*) into v_citizens
  from public.profiles
  where (role in ('user', 'citizen') or lower(role) in ('user', 'citizen'))
     or (role is null or role not in ('ngo', 'admin'));

  -- 2. Real Resolved requests count (waste_reports with status = 'resolved' and not deleted)
  select count(*) into v_resolved
  from public.waste_reports
  where lower(status) = 'resolved'
    and (deleted is false or deleted is null);

  -- 3. Real Reported requests count (all active waste_reports)
  select count(*) into v_reported
  from public.waste_reports
  where (deleted is false or deleted is null);

  -- 4. Real NGO count (maximum of profiles with role = 'ngo' and rows in ngos table)
  select count(*) into v_ngos
  from public.profiles
  where role = 'ngo' or lower(role) = 'ngo';

  select count(*) into v_ngos_table from public.ngos;

  v_ngos := greatest(coalesce(v_ngos, 0), coalesce(v_ngos_table, 0));

  return jsonb_build_object(
    'citizens', coalesce(v_citizens, 0),
    'resolved', coalesce(v_resolved, 0),
    'ngos', coalesce(v_ngos, 0),
    'reported', coalesce(v_reported, 0)
  );
end;
$$;

-- Grant execution to both unauthenticated visitors and authenticated users
grant execute on function public.get_public_platform_stats() to anon, authenticated;
