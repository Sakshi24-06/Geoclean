-- Safe follow-up for projects where the original NGO workflow migration has already run.
-- This preserves the current trigger, foreign keys, and unique constraints.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, mobile_number, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    new.raw_user_meta_data->>'mobile_number',
    coalesce(new.raw_user_meta_data->>'role', 'user')
  ) on conflict (id) do nothing;

  if coalesce(new.raw_user_meta_data->>'role', 'user') = 'ngo' then
    insert into public.ngos (profile_id, ngo_name, address, latitude, longitude, mobile_number)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'ngo_name', new.email),
      coalesce(new.raw_user_meta_data->>'address', 'Service area not set'),
      nullif(new.raw_user_meta_data->>'latitude', '')::double precision,
      nullif(new.raw_user_meta_data->>'longitude', '')::double precision,
      new.raw_user_meta_data->>'mobile_number'
    ) on conflict (profile_id) do nothing;
  end if;
  return new;
end;
$$;
