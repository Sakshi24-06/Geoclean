-- Optional schema enhancement for Citizen Profile address fields
alter table if exists public.profiles add column if not exists area text;
alter table if exists public.profiles add column if not exists locality text;
alter table if exists public.profiles add column if not exists landmark text;
alter table if exists public.profiles add column if not exists street text;
alter table if exists public.profiles add column if not exists district text;
alter table if exists public.profiles add column if not exists state text;
alter table if exists public.profiles add column if not exists pincode text;
alter table if exists public.profiles add column if not exists avatar_url text;
