-- GeoClean NGO-Only Delete Cleanup Permission Migration
-- Strict database-level security for Before & After cleanup/impact results

-- 1. Function: delete_ngo_cleanup_result
-- Allows ONLY authenticated NGOs to delete their own cleanup/impact results
create or replace function public.delete_ngo_cleanup_result(p_report_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_ngo_id uuid;
  v_report public.waste_reports%rowtype;
begin
  -- 1. Verify user is authenticated
  if v_uid is null then
    raise exception 'Authentication required: You must be logged in to perform this action';
  end if;

  -- 2. Verify user has role 'ngo'
  select role into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role != 'ngo' then
    raise exception 'Permission denied: Only NGO accounts are permitted to delete cleanup results';
  end if;

  -- 3. Retrieve NGO organization record
  select id into v_ngo_id from public.ngos where profile_id = v_uid;
  if v_ngo_id is null then
    raise exception 'Permission denied: NGO organization profile not found for this user';
  end if;

  -- 4. Locate the target waste report (by UUID or report_code)
  if p_report_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_report from public.waste_reports
    where id = p_report_id::uuid or report_code = p_report_id
    for update;
  else
    select * into v_report from public.waste_reports
    where report_code = p_report_id
    for update;
  end if;

  if not found then
    raise exception 'Report not found';
  end if;

  -- 5. Strict Ownership Check: Must be assigned to or resolved by THIS specific NGO
  if (v_report.assigned_ngo_id is distinct from v_ngo_id) and (v_report.resolved_by is distinct from v_ngo_id) then
    raise exception 'Permission denied: An NGO can only delete its own cleanup results';
  end if;

  -- 6. Delete all child records and the waste report permanently from the database
  delete from public.report_images where report_id = v_report.id;
  delete from public.ngo_assignments where report_id = v_report.id;
  delete from public.notifications where report_id = v_report.id;
  delete from public.report_status_history where report_id = v_report.id;
  delete from public.waste_reports where id = v_report.id;

  return jsonb_build_object(
    'success', true,
    'report_id', v_report.id,
    'report_code', v_report.report_code,
    'message', 'Cleanup result deleted successfully.'
  );
end;
$$;

-- Overload for uuid argument for compatibility
create or replace function public.delete_ngo_cleanup_result(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.delete_ngo_cleanup_result(p_report_id::text);
end;
$$;

-- Grant execution permission to authenticated users
grant execute on function public.delete_ngo_cleanup_result(text) to authenticated;
grant execute on function public.delete_ngo_cleanup_result(uuid) to authenticated;

-- 2. Row Level Security Policies for direct DELETE attempts

-- 2A. waste_reports DELETE policy (NGO can delete only its own assigned reports)
drop policy if exists "ngo delete own reports" on public.waste_reports;
create policy "ngo delete own reports" on public.waste_reports
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.ngos n on n.profile_id = p.id
      where p.id = auth.uid()
        and p.role = 'ngo'
        and (waste_reports.assigned_ngo_id = n.id or waste_reports.resolved_by = n.id)
    )
  );

-- 2B. report_images DELETE policy (NGO can delete only images of its own assigned reports)
drop policy if exists "ngo delete own after images" on public.report_images;
create policy "ngo delete own after images" on public.report_images
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.ngos n on n.profile_id = p.id
      where p.id = auth.uid()
        and p.role = 'ngo'
        and exists (
          select 1 from public.waste_reports r
          where r.id = report_images.report_id
            and (r.assigned_ngo_id = n.id or r.resolved_by = n.id)
        )
    )
  );

-- 2C. storage.objects DELETE policy for report-images bucket (NGO can delete only from its own folder)
drop policy if exists "ngo delete own uploaded images" on storage.objects;
create policy "ngo delete own uploaded images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'report-images' and
    (storage.foldername(name))[1] = auth.uid()::text and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'ngo')
  );
