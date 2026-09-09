-- GeoClean Live Request Tracking & Concurrency-Safe NGO Claim System
-- Migration: 20260907_live_request_tracking.sql

-- 1. Security Definer RPC: Concurrency-safe claim operation for NGOs
create or replace function public.claim_waste_report(p_report_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_role text;
  v_ngo_id uuid;
  v_ngo_name text;
  v_report public.waste_reports;
  v_citizen_uid uuid;
  v_address text;
begin
  -- 1. Authentication check
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Authentication required: You must be signed in as an NGO to claim requests.';
  end if;

  -- 2. Role check
  select role into v_role from public.profiles where id = v_uid;
  if v_role is null or v_role != 'ngo' then
    raise exception 'Permission denied: Only registered NGO accounts can claim cleanup requests.';
  end if;

  -- 3. Resolve NGO details
  select id, ngo_name into v_ngo_id, v_ngo_name from public.ngos where profile_id = v_uid limit 1;
  if v_ngo_id is null then
    -- Fallback create or resolve NGO record
    insert into public.ngos (profile_id, ngo_name, address)
    values (v_uid, coalesce((select full_name from public.profiles where id = v_uid), 'Partner NGO'), 'Service Area')
    on conflict (profile_id) do nothing;

    select id, ngo_name into v_ngo_id, v_ngo_name from public.ngos where profile_id = v_uid limit 1;
  end if;

  if v_ngo_name is null or v_ngo_name = '' then
    v_ngo_name := 'Partner NGO';
  end if;

  -- 4. Atomic row lock on target report (prevents concurrent claim race condition)
  begin
    select * into v_report
    from public.waste_reports
    where (id::text = p_report_id or report_code = p_report_id)
      and (deleted is not true and status != 'deleted')
    for update;
  exception
    when others then
      select * into v_report
      from public.waste_reports
      where (report_code = p_report_id)
        and (deleted is not true and status != 'deleted')
      for update;
  end;

  if v_report.id is null then
    raise exception 'Report not found or has already been deleted.';
  end if;

  -- 5. Status & Overlap Validation
  if v_report.status = 'resolved' then
    raise exception 'This request has already been resolved and cannot be claimed.';
  end if;

  if v_report.assigned_ngo_id is not null or v_report.status in ('assigned', 'in_progress', 'resolving') then
    -- If already assigned to this exact NGO, return success
    if v_report.assigned_ngo_id = v_ngo_id then
      return json_build_object(
        'success', true,
        'message', 'Request is already assigned to your NGO.',
        'report_id', v_report.id,
        'report_code', v_report.report_code,
        'ngo_name', v_ngo_name,
        'status', v_report.status
      );
    end if;

    raise exception 'This request has already been claimed by another NGO.';
  end if;

  -- 6. Atomically update report assignment
  update public.waste_reports
  set
    status = 'assigned',
    assigned_ngo_id = v_ngo_id,
    updated_at = now()
  where id = v_report.id
  returning * into v_report;

  -- 7. Record NGO Assignment entry
  insert into public.ngo_assignments (report_id, ngo_id, status, accepted_at)
  values (v_report.id, v_ngo_id, 'accepted', now())
  on conflict (report_id, ngo_id) do update
  set status = 'accepted', accepted_at = now(), rejected_at = null, rejection_reason = null;

  -- 8. Record in Status History
  begin
    insert into public.report_status_history (
      report_id,
      report_code,
      old_status,
      new_status,
      changed_by,
      changed_by_name,
      changed_by_role,
      note,
      created_at
    ) values (
      v_report.id::text,
      v_report.report_code,
      'Submitted',
      'Assigned',
      v_uid::text,
      v_ngo_name,
      'ngo',
      'Claimed via NGO Live Request Tracking',
      now()
    );
  exception
    when others then
      null;
  end;

  -- 9. Send real-time notification to the reporting Citizen
  v_citizen_uid := v_report.user_id;
  v_address := coalesce(v_report.address, 'Reported location');

  if v_citizen_uid is not null then
    begin
      insert into public.notifications (
        user_id,
        report_id,
        title,
        message,
        read,
        created_at
      ) values (
        v_citizen_uid,
        v_report.id,
        'Cleanup Partner Assigned',
        'Your report ' || v_report.report_code || ' at ' || v_address || ' has been claimed by ' || v_ngo_name || ' and scheduled for cleanup.',
        false,
        now()
      );
    exception
      when others then
        null;
    end if;
  end if;

  return json_build_object(
    'success', true,
    'message', 'Request successfully claimed by your NGO.',
    'report_id', v_report.id,
    'report_code', v_report.report_code,
    'ngo_id', v_ngo_id,
    'ngo_name', v_ngo_name,
    'status', 'assigned'
  );
end;
$$;

-- Grant execution to authenticated users
grant execute on function public.claim_waste_report(text) to authenticated;
