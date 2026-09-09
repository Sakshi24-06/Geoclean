-- GeoClean Secure Account Deletion RPC
-- Safely cleans up relations for Citizens and NGOs without breaking foreign key constraints

create or replace function public.delete_user_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_ngo_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Authentication required. Please sign in to delete your account.');
  end if;

  -- 1. Identify user role
  select role into v_role from public.profiles where id = v_user_id;

  -- 2. If NGO account:
  if v_role = 'ngo' or exists (select 1 from public.ngos where profile_id = v_user_id) then
    select id into v_ngo_id from public.ngos where profile_id = v_user_id;
    if v_ngo_id is not null then
      -- Re-open active reports assigned to this NGO so other teams can take them
      update public.waste_reports
      set assigned_ngo_id = null, status = 'available'
      where assigned_ngo_id = v_ngo_id and status in ('assigned', 'in_progress', 'available');

      -- For historical resolved reports, nullify the foreign key references
      update public.waste_reports
      set assigned_ngo_id = null, resolved_by = null
      where assigned_ngo_id = v_ngo_id or resolved_by = v_ngo_id;

      -- Remove assignments
      delete from public.ngo_assignments where ngo_id = v_ngo_id;

      -- Delete NGO record (will remove it from the directory immediately)
      delete from public.ngos where id = v_ngo_id;
    end if;
  end if;

  -- 3. If Citizen / general user account:
  -- Nullify audit references in history
  update public.report_status_history set changed_by = null where changed_by = v_user_id;
  update public.waste_reports set deleted_by = null where deleted_by = v_user_id;

  -- Clean up citizen's submitted reports and related images safely
  delete from public.waste_reports where user_id = v_user_id;

  -- 4. Delete user's notifications
  delete from public.notifications where user_id = v_user_id;

  -- 5. Delete profile record
  delete from public.profiles where id = v_user_id;

  -- 6. Delete from auth.users securely
  delete from auth.users where id = v_user_id;

  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

grant execute on function public.delete_user_account() to authenticated;
