-- Enforce globally unique @handles (username). Display names stay unrestricted.

-- Dedupe any existing rows before adding/keeping the unique constraint
with ranked as (
    select
        id,
        username,
        row_number() over (partition by lower(username) order by updated_at nulls last, id) as rn
    from public.profiles
    where username is not null and trim(username) <> ''
)
update public.profiles p
set username = left(p.username, 25) || '_' || right(replace(p.id::text, '-', ''), 4)
from ranked r
where p.id = r.id
  and r.rn > 1;

update public.profiles
set username = 'user_' || right(replace(id::text, '-', ''), 8)
where username is null or length(trim(username)) < 3;

alter table public.profiles drop constraint if exists profiles_username_unique;
alter table public.profiles
    add constraint profiles_username_unique unique (username);

create index if not exists profiles_username_idx on public.profiles (username);

-- Check if a handle is free (case-insensitive via normalize_username)
create or replace function public.is_username_available(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
    uname text;
begin
    uname := public.normalize_username(p_username);
    if length(uname) < 3 then
        return jsonb_build_object('ok', true, 'available', false, 'reason', 'USERNAME_TOO_SHORT');
    end if;

    return jsonb_build_object(
        'ok', true,
        'available', not exists (
            select 1
            from public.profiles p
            where p.username = uname
              and (uid is null or p.id <> uid)
        ),
        'username', uname
    );
end;
$$;

grant execute on function public.is_username_available(text) to authenticated;

-- Profile writes must go through this RPC (unique handle + normalized format)
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

    if exists (
        select 1
        from public.profiles p
        where p.username = uname
          and p.id <> uid
    ) then
        return jsonb_build_object('ok', false, 'error', 'USERNAME_TAKEN');
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

-- Handles only change via upsert_my_profile (security definer); users can read profiles
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "users insert own profile" on public.profiles;
