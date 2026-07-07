-- Public host profiles for scheduling (display name, @username, avatar)
-- Safe when public.profiles already exists (e.g. Supabase starter schema).

create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Legacy Supabase templates often use full_name instead of display_name
do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'profiles'
          and column_name = 'full_name'
    ) then
        update public.profiles
        set display_name = coalesce(
            nullif(trim(display_name), ''),
            nullif(trim(full_name), '')
        )
        where display_name is null or trim(display_name) = '';
    end if;
end $$;

create or replace function public.normalize_username(raw text)
returns text
language sql
immutable
as $$
    select left(
        regexp_replace(lower(coalesce(trim(raw), '')), '[^a-z0-9_]', '', 'g'),
        30
    );
$$;

-- Backfill username / display_name for existing rows
update public.profiles p
set
    username = coalesce(
        nullif(trim(p.username), ''),
        public.normalize_username(split_part(u.email, '@', 1))
    ),
    display_name = coalesce(
        nullif(trim(p.display_name), ''),
        nullif(trim(p.username), ''),
        public.normalize_username(split_part(u.email, '@', 1)),
        'Host'
    )
from auth.users u
where u.id = p.id
  and (
      p.username is null
      or trim(p.username) = ''
      or p.display_name is null
      or trim(p.display_name) = ''
  );

-- Resolve duplicate usernames after backfill
with ranked as (
    select
        id,
        username,
        row_number() over (partition by username order by updated_at nulls last, id) as rn
    from public.profiles
    where username is not null
)
update public.profiles p
set username = left(p.username, 25) || '_' || right(replace(p.id::text, '-', ''), 4)
from ranked r
where p.id = r.id
  and r.rn > 1;

update public.profiles
set username = 'user_' || right(replace(id::text, '-', ''), 8)
where username is null or length(trim(username)) < 3;

update public.profiles
set display_name = coalesce(nullif(trim(display_name), ''), username, 'Host')
where display_name is null or trim(display_name) = '';

alter table public.profiles alter column username set not null;
alter table public.profiles alter column display_name set not null;
alter table public.profiles alter column updated_at set not null;
alter table public.profiles alter column updated_at set default now();

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles
    add constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$');

alter table public.profiles drop constraint if exists profiles_username_unique;
alter table public.profiles
    add constraint profiles_username_unique unique (username);

create index if not exists profiles_username_idx on public.profiles (username);

alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
    on public.profiles
    for select
    using (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
    on public.profiles
    for all
    using (auth.uid() = id)
    with check (auth.uid() = id);

drop policy if exists "public read profiles for scheduling" on public.profiles;
create policy "public read profiles for scheduling"
    on public.profiles
    for select
    using (true);

-- Avatar storage (public read)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'avatars',
    'avatars',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read"
    on storage.objects
    for select
    using (bucket_id = 'avatars');

drop policy if exists "avatars owner upload" on storage.objects;
create policy "avatars owner upload"
    on storage.objects
    for insert
    with check (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update"
    on storage.objects
    for update
    using (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete"
    on storage.objects
    for delete
    using (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create or replace function public.get_my_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
    row public.profiles%rowtype;
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    end if;

    select * into row from public.profiles where id = uid;

    if not found then
        return jsonb_build_object('ok', true, 'profile', null);
    end if;

    return jsonb_build_object(
        'ok', true,
        'profile', jsonb_build_object(
            'username', row.username,
            'displayName', row.display_name,
            'avatarUrl', row.avatar_url
        )
    );
end;
$$;

grant execute on function public.get_my_profile() to authenticated;

create or replace function public.upsert_my_profile(
    p_username text,
    p_display_name text,
    p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
    uname text;
    dname text;
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    end if;

    uname := public.normalize_username(p_username);
    if length(uname) < 3 then
        return jsonb_build_object('ok', false, 'error', 'USERNAME_TOO_SHORT');
    end if;

    dname := coalesce(nullif(trim(p_display_name), ''), 'Host');

    insert into public.profiles (id, username, display_name, avatar_url, updated_at)
    values (uid, uname, dname, nullif(trim(p_avatar_url), ''), now())
    on conflict (id) do update
    set username = excluded.username,
        display_name = excluded.display_name,
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

    return jsonb_build_object(
        'ok', true,
        'profile', jsonb_build_object(
            'username', uname,
            'displayName', dname,
            'avatarUrl', (select avatar_url from public.profiles where id = uid)
        )
    );
exception
    when unique_violation then
        return jsonb_build_object('ok', false, 'error', 'USERNAME_TAKEN');
end;
$$;

grant execute on function public.upsert_my_profile(text, text, text) to authenticated;

-- Merge live host profile into scheduling link payload for public booking pages
create or replace function public.get_scheduling_link(link_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    link_row public.scheduling_links%rowtype;
    payload jsonb;
    prof public.profiles%rowtype;
begin
    select * into link_row
    from public.scheduling_links
    where slug = link_slug
      and active = true
    limit 1;

    if not found then
        return null;
    end if;

    payload := link_row.payload;

    if payload ? 'expiresAt'
       and nullif(payload ->> 'expiresAt', '') is not null
       and (payload ->> 'expiresAt')::timestamptz < now() then
        return null;
    end if;

    select * into prof from public.profiles where id = link_row.user_id;

    if found then
        payload := payload
            || jsonb_build_object(
                'hostDisplayName', coalesce(nullif(trim(prof.display_name), ''), payload ->> 'hostName', 'Host'),
                'hostUsername', prof.username,
                'hostAvatarUrl', prof.avatar_url,
                'hostName', coalesce(nullif(trim(prof.display_name), ''), payload ->> 'hostName', 'Host')
            );
    else
        payload := payload
            || jsonb_build_object(
                'hostDisplayName', coalesce(payload ->> 'hostName', 'Host'),
                'hostUsername', null,
                'hostAvatarUrl', null,
                'hostName', coalesce(payload ->> 'hostName', 'Host')
            );
    end if;

    return payload;
end;
$$;

-- Booking emails: prefer live profile display name
create or replace function public.get_booking_for_notify(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    result jsonb;
begin
    select jsonb_build_object(
        'id', b.id,
        'slug', b.slug,
        'booking_date', b.booking_date,
        'start_min', b.start_min,
        'duration_min', b.duration_min,
        'guest_name', b.guest_name,
        'guest_email', b.guest_email,
        'guest_phone', b.guest_phone,
        'guest_details', b.guest_details,
        'link_title', coalesce(sl.payload ->> 'title', 'Meeting'),
        'host_name', coalesce(
            nullif(trim(p.display_name), ''),
            sl.payload ->> 'hostName',
            'Host'
        ),
        'host_username', p.username,
        'host_email', coalesce(nullif(trim(sl.payload ->> 'hostEmail'), ''), u.email),
        'timezone', coalesce(sl.payload ->> 'timezone', 'UTC'),
        'location_type', sl.payload ->> 'locationType',
        'location_value', sl.payload ->> 'locationValue',
        'description', sl.payload ->> 'description'
    )
    into result
    from public.scheduling_bookings b
    inner join public.scheduling_links sl on sl.id = b.link_id
    inner join auth.users u on u.id = sl.user_id
    left join public.profiles p on p.id = sl.user_id
    where b.id = p_booking_id;

    return result;
end;
$$;
