-- NikahConnect final Supabase schema
-- Paste into the Supabase SQL Editor for a fresh project.
-- This schema reflects the final state of the ordered migrations.

-- Required Supabase extensions are normally enabled by default.
create extension if not exists pgcrypto;

-- ============================================================
-- Types
-- ============================================================

do $$ begin
  create type public.app_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.gender_type as enum ('male', 'female', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.plan_type as enum ('starter', 'standard', 'premium');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'success', 'failed');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Tables
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  gender public.gender_type not null,
  dob date not null,
  location text not null,
  bio text default '',
  avatar_url text,
  interests text[] default '{}',
  occupation text default '',
  relationship_goal text default '',
  suspended boolean not null default false,
  deactivated_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  phone_number text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(sender_id, receiver_id),
  check (sender_id <> receiver_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_one uuid not null references public.profiles(id) on delete cascade,
  user_two uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_one, user_two),
  check (user_one < user_two)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  read_at timestamptz,
  reply_to_message_id uuid references public.messages(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_no_digits check (content !~ '[0-9]'),
  constraint messages_not_empty check (length(btrim(content)) > 0)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan public.plan_type not null,
  remaining_reveals int not null default 0,
  is_unlimited boolean not null default false,
  start_date timestamptz not null default now(),
  expiry_date timestamptz,
  payment_id uuid
);

create table if not exists public.number_reveals (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  profile_owner_id uuid not null references public.profiles(id) on delete cascade,
  revealed_at timestamptz not null default now(),
  idempotency_key text,
  unique(viewer_id, profile_owner_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  transaction_id text unique,
  amount int not null,
  status public.payment_status not null default 'pending',
  plan_type public.plan_type not null,
  mpesa_phone text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_settings (
  provider text primary key,
  api_username text not null,
  api_password text not null,
  channel_id text not null,
  verified_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions
  drop constraint if exists subscriptions_payment_id_fkey;
alter table public.subscriptions
  add constraint subscriptions_payment_id_fkey
  foreign key (payment_id) references public.payments(id) on delete set null;

-- ============================================================
-- Private security helpers and public profile projection
-- ============================================================
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

revoke all on function private.has_role(uuid, public.app_role) from public;
grant execute on function private.has_role(uuid, public.app_role) to authenticated, service_role;

create or replace function private.get_public_profiles()
returns table (
  id uuid,
  full_name text,
  gender public.gender_type,
  location text,
  bio text,
  avatar_url text,
  interests text[],
  occupation text,
  relationship_goal text,
  age int,
  suspended boolean,
  created_at timestamptz,
  last_seen_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.gender,
    p.location,
    p.bio,
    p.avatar_url,
    p.interests,
    p.occupation,
    p.relationship_goal,
    extract(year from age(p.dob))::int,
    p.suspended,
    p.created_at,
    p.last_seen_at
  from public.profiles p
  where p.suspended = false
    and p.deactivated_at is null
    and auth.uid() is not null
    and not exists (
      select 1 from public.user_roles r
      where r.user_id = p.id and r.role = 'admin'::public.app_role
    )
$$;

revoke all on function private.get_public_profiles() from public, anon, authenticated;
grant execute on function private.get_public_profiles() to authenticated;

drop view if exists public.public_profiles;
create view public.public_profiles with (security_invoker = true) as
select * from private.get_public_profiles();
grant select on public.public_profiles to authenticated;

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('terms', 'profile_visibility')),
  consent_version text not null,
  consented_at timestamptz not null default now(),
  unique (user_id, consent_type, consent_version)
);
alter table public.user_consents enable row level security;
revoke all on public.user_consents from public, anon, authenticated;
grant all on public.user_consents to service_role;

-- ============================================================
-- Application functions and triggers
-- ============================================================
create or replace function public.admin_search_members(
  search_term text,
  page_size integer,
  page_offset integer
)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  location text,
  suspended boolean,
  deactivated_at timestamptz,
  created_at timestamptz,
  email text,
  is_admin boolean,
  total_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with filtered as (
    select
      p.id,
      p.full_name,
      p.avatar_url,
      p.location,
      p.suspended,
      p.deactivated_at,
      p.created_at,
      coalesce(c.email, '') as email,
      exists (
        select 1 from public.user_roles r
        where r.user_id = p.id and r.role = 'admin'
      ) as is_admin
    from public.profiles p
    left join public.user_contacts c on c.user_id = p.id
    where search_term = ''
      or p.full_name ilike '%' || search_term || '%'
      or p.location ilike '%' || search_term || '%'
      or c.email ilike '%' || search_term || '%'
  )
  select
    f.id,
    f.full_name,
    f.avatar_url,
    f.location,
    f.suspended,
    f.deactivated_at,
    f.created_at,
    f.email,
    f.is_admin,
    count(*) over () as total_count
  from filtered f
  order by f.created_at desc, f.id
  limit least(greatest(page_size, 1), 50)
  offset greatest(page_offset, 0);
$$;
revoke all on function public.admin_search_members(text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_search_members(text, integer, integer) to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_dob date;
  v_terms_version text;
begin
  if new.raw_user_meta_data->>'terms_accepted' is distinct from 'true'
     or new.raw_user_meta_data->>'profile_visibility_accepted' is distinct from 'true' then
    raise exception 'registration_requires_consent';
  end if;
  v_terms_version := new.raw_user_meta_data->>'terms_version';
  if v_terms_version is distinct from '2026-10-13' then
    raise exception 'registration_requires_current_terms';
  end if;
  v_dob := (new.raw_user_meta_data->>'dob')::date;
  if v_dob > (current_date - interval '18 years')::date then
    raise exception 'registration_requires_adult';
  end if;
  insert into public.profiles (id, full_name, gender, dob, location)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'gender')::public.gender_type, 'other'),
    v_dob,
    coalesce(new.raw_user_meta_data->>'location', '')
  );
  insert into public.user_contacts (user_id, email, phone_number)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'phone_number', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  insert into public.user_consents (user_id, consent_type, consent_version)
  values
    (new.id, 'terms', v_terms_version),
    (new.id, 'profile_visibility', v_terms_version);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_mutual_like()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  u1 uuid;
  u2 uuid;
begin
  if exists (
    select 1 from public.likes
    where sender_id = new.receiver_id and receiver_id = new.sender_id
  ) then
    u1 := least(new.sender_id, new.receiver_id);
    u2 := greatest(new.sender_id, new.receiver_id);
    insert into public.matches (user_one, user_two)
    values (u1, u2) on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_like_insert on public.likes;
create trigger on_like_insert
  after insert on public.likes
  for each row execute function public.handle_mutual_like();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function private.require_adult_profile()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.dob is null or new.dob > (current_date - interval '18 years')::date then
    raise exception 'registration_requires_adult';
  end if;
  return new;
end;
$$;
create trigger profiles_require_adult before insert or update of dob on public.profiles
  for each row execute function private.require_adult_profile();

drop trigger if exists user_contacts_touch_updated_at on public.user_contacts;
create trigger user_contacts_touch_updated_at before update on public.user_contacts
  for each row execute function public.touch_updated_at();
drop trigger if exists payments_touch on public.payments;
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Atomic reveal consumption
-- ============================================================
create or replace function public.consume_reveal(
  _viewer uuid,
  _owner uuid,
  _idempotency_key text default null
) returns table(reveal_id uuid, already_revealed boolean)
language plpgsql security definer set search_path = public
as $$
declare
  v_existing uuid;
  v_sub_id uuid;
  v_is_unlimited boolean;
  v_recent_3s int;
  v_recent_min int;
  v_recent_day int;
  v_new_id uuid;
begin
  if _viewer is null or _owner is null then raise exception 'invalid_input'; end if;
  if _viewer = _owner then raise exception 'self_reveal'; end if;

  if _idempotency_key is not null then
    select id into v_existing from public.number_reveals
    where viewer_id = _viewer and idempotency_key = _idempotency_key limit 1;
    if v_existing is not null then
      return query select v_existing, true;
      return;
    end if;
  end if;

  select id into v_existing from public.number_reveals
  where viewer_id = _viewer and profile_owner_id = _owner limit 1;
  if v_existing is not null then
    return query select v_existing, true;
    return;
  end if;

  select count(*) into v_recent_3s from public.number_reveals
  where viewer_id = _viewer and revealed_at > now() - interval '3 seconds';
  if v_recent_3s > 0 then raise exception 'cooldown'; end if;
  select count(*) into v_recent_min from public.number_reveals
  where viewer_id = _viewer and revealed_at > now() - interval '1 minute';
  if v_recent_min >= 5 then raise exception 'rate_minute'; end if;
  select count(*) into v_recent_day from public.number_reveals
  where viewer_id = _viewer and revealed_at > now() - interval '24 hours';
  if v_recent_day >= 50 then raise exception 'rate_day'; end if;

  select s.id, s.is_unlimited into v_sub_id, v_is_unlimited
  from public.subscriptions s
  join public.payments p on p.id = s.payment_id
  where s.user_id = _viewer
    and p.user_id = _viewer
    and p.status = 'success'
    and (s.expiry_date is null or s.expiry_date > now())
    and (s.is_unlimited or s.remaining_reveals > 0)
  order by s.start_date desc
  limit 1
  for update of s;

  if v_sub_id is null then raise exception 'no_active_paid_subscription'; end if;
  if not v_is_unlimited then
    update public.subscriptions
    set remaining_reveals = remaining_reveals - 1
    where id = v_sub_id and remaining_reveals > 0;
    if not found then raise exception 'no_balance'; end if;
  end if;

  insert into public.number_reveals (viewer_id, profile_owner_id, idempotency_key)
  values (_viewer, _owner, _idempotency_key)
  returning id into v_new_id;
  return query select v_new_id, false;
end;
$$;

revoke all on function public.consume_reveal(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.consume_reveal(uuid, uuid, text) to service_role;

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_messages_match on public.messages(match_id, created_at);
create index if not exists idx_likes_receiver on public.likes(receiver_id);
create index if not exists idx_matches_users on public.matches(user_one, user_two);
create index if not exists idx_subs_user on public.subscriptions(user_id, start_date desc);
create unique index if not exists subscriptions_payment_id_unique
  on public.subscriptions(payment_id) where payment_id is not null;
create unique index if not exists number_reveals_viewer_idem_unique
  on public.number_reveals(viewer_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists number_reveals_viewer_time_idx
  on public.number_reveals(viewer_id, revealed_at desc);
create unique index if not exists payments_user_idempotency_key_uniq
  on public.payments(user_id, idempotency_key)
  where idempotency_key is not null;

-- ============================================================
-- Grants and RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.user_contacts enable row level security;
alter table public.profile_photos enable row level security;
alter table public.user_roles enable row level security;
alter table public.likes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.subscriptions enable row level security;
alter table public.number_reveals enable row level security;
alter table public.payments enable row level security;
alter table public.payment_settings enable row level security;

grant select (id, full_name, gender, dob, location, bio, avatar_url, interests,
  occupation, relationship_goal, deactivated_at, last_seen_at, created_at, updated_at)
  on public.profiles to authenticated;
grant update (full_name, location, bio, occupation, relationship_goal, interests,
  avatar_url, last_seen_at) on public.profiles to authenticated;
grant select on public.user_contacts to authenticated;
grant select, insert, update, delete on public.profile_photos to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, delete on public.likes to authenticated;
grant select, delete on public.matches to authenticated;
grant select, insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.number_reveals to authenticated;
grant select on public.payments to authenticated;
grant all on all tables in schema public to service_role;

-- Profiles
create policy "Members view own profile and admins view profiles"
  on public.profiles for select to authenticated
  using (id = auth.uid() or private.has_role(auth.uid(), 'admin'));
create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "Admins delete profiles"
  on public.profiles for delete to authenticated
  using (private.has_role(auth.uid(), 'admin'));

-- Contacts and photos
create policy "Owners view own contact info"
  on public.user_contacts for select to authenticated using (user_id = auth.uid());
create policy "Members view member profile photos"
  on public.profile_photos for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from private.get_public_profiles() member
      where member.id = profile_photos.user_id
    )
  );
create policy "Users manage own profile photos insert"
  on public.profile_photos for insert to authenticated with check (user_id = auth.uid());
create policy "Users manage own profile photos update"
  on public.profile_photos for update to authenticated using (user_id = auth.uid());
create policy "Users manage own profile photos delete"
  on public.profile_photos for delete to authenticated using (user_id = auth.uid());

-- Roles
create policy "Users view own roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or private.has_role(auth.uid(), 'admin'));
create policy "Only admins insert roles"
  on public.user_roles for insert to authenticated
  with check (private.has_role(auth.uid(), 'admin'));
create policy "Only admins update roles"
  on public.user_roles for update to authenticated
  using (private.has_role(auth.uid(), 'admin'))
  with check (private.has_role(auth.uid(), 'admin'));
create policy "Only admins delete roles"
  on public.user_roles for delete to authenticated
  using (private.has_role(auth.uid(), 'admin'));

create or replace function public.can_view_incoming_likes()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    join public.payments p on p.id = s.payment_id
    where s.user_id = auth.uid()
      and (s.expiry_date is null or s.expiry_date > now())
      and p.user_id = auth.uid()
      and p.status = 'success'
  );
$$;
revoke all on function public.can_view_incoming_likes() from public;
grant execute on function public.can_view_incoming_likes() to authenticated;

-- Social features
create policy "Users view likes between member accounts"
  on public.likes for select to authenticated
  using (
    (sender_id = auth.uid() and not private.has_role(receiver_id, 'admin'::public.app_role))
    or (
      receiver_id = auth.uid()
      and public.can_view_incoming_likes()
      and not private.has_role(sender_id, 'admin'::public.app_role)
    )
  );
create policy "Users like member profiles"
  on public.likes for insert to authenticated
  with check (
    sender_id = auth.uid()
    and not private.has_role(receiver_id, 'admin'::public.app_role)
  );
create policy "Users remove their own likes"
  on public.likes for delete to authenticated using (sender_id = auth.uid());
create policy "Users view member matches"
  on public.matches for select to authenticated
  using (
    (user_one = auth.uid() or user_two = auth.uid())
    and (
      private.has_role(auth.uid(), 'admin'::public.app_role)
      or (
        not private.has_role(user_one, 'admin'::public.app_role)
        and not private.has_role(user_two, 'admin'::public.app_role)
      )
    )
  );
create policy "Participants or admins delete matches"
  on public.matches for delete to authenticated
  using (user_one = auth.uid() or user_two = auth.uid() or private.has_role(auth.uid(), 'admin'));
create policy "Users view messages in their matches"
  on public.messages for select to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and (m.user_one = auth.uid() or m.user_two = auth.uid())));
create policy "Users send messages in their matches"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and exists (select 1 from public.matches m where m.id = match_id and (m.user_one = auth.uid() or m.user_two = auth.uid())));
create policy "Recipients mark messages as read"
  on public.messages for update to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and (m.user_one = auth.uid() or m.user_two = auth.uid())) and sender_id <> auth.uid())
  with check (exists (select 1 from public.matches m where m.id = match_id and (m.user_one = auth.uid() or m.user_two = auth.uid())) and sender_id <> auth.uid());

-- Paid plans and reveals
create policy "Users view own subscriptions"
  on public.subscriptions for select to authenticated
  using (user_id = auth.uid() or private.has_role(auth.uid(), 'admin'));
create policy "Admins create subscriptions"
  on public.subscriptions for insert to authenticated
  with check (private.has_role(auth.uid(), 'admin'));
create policy "Admins update subscriptions"
  on public.subscriptions for update to authenticated
  using (private.has_role(auth.uid(), 'admin')) with check (private.has_role(auth.uid(), 'admin'));
create policy "Admins delete subscriptions"
  on public.subscriptions for delete to authenticated
  using (private.has_role(auth.uid(), 'admin'));
create policy "Users view their reveals"
  on public.number_reveals for select to authenticated
  using (viewer_id = auth.uid() or private.has_role(auth.uid(), 'admin'));
create policy "Viewers record their own reveals"
  on public.number_reveals for insert to authenticated with check (viewer_id = auth.uid());
create policy "Viewer or admin deletes reveals"
  on public.number_reveals for delete to authenticated
  using (viewer_id = auth.uid() or private.has_role(auth.uid(), 'admin'));

-- Payments
create policy "Users view own payments"
  on public.payments for select to authenticated
  using (user_id = auth.uid() or private.has_role(auth.uid(), 'admin'));
create policy "Users create own payments"
  on public.payments for insert to authenticated with check (user_id = auth.uid());
create policy "Admins update payments"
  on public.payments for update to authenticated
  using (private.has_role(auth.uid(), 'admin')) with check (private.has_role(auth.uid(), 'admin'));
create policy "Admins delete payments"
  on public.payments for delete to authenticated
  using (private.has_role(auth.uid(), 'admin'));

-- Payment settings are service-role only.
revoke all on public.payment_settings from anon, authenticated;

-- ============================================================
-- Realtime and storage
-- ============================================================
alter table public.messages replica identity full;
alter publication supabase_realtime add table public.messages;

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy "Authenticated can view member profile photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from private.get_public_profiles() member
        where member.id::text = (storage.foldername(name))[1]
      )
    )
  );
create policy "Users upload their own profile photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update own profile photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own profile photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Lock down trigger function execution; auth can still invoke the trigger indirectly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_mutual_like() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
