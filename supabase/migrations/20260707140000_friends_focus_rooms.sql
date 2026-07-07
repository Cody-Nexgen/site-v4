-- Phase 3: Friends (minimal) + Live Focus Rooms

-- Friendships (requester → addressee)
create table if not exists public.friendships (
    id uuid primary key default gen_random_uuid(),
    requester_id uuid not null references auth.users (id) on delete cascade,
    addressee_id uuid not null references auth.users (id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'accepted')),
    created_at timestamptz not null default now(),
    unique (requester_id, addressee_id),
    check (requester_id <> addressee_id)
);

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

-- Active focus presence (for friends list)
create table if not exists public.friend_presence (
    user_id uuid primary key references auth.users (id) on delete cascade,
    is_focusing boolean not null default false,
    session_ends_at timestamptz,
    updated_at timestamptz not null default now()
);

-- Weekly focus minutes for friend leaderboard
create table if not exists public.weekly_focus (
    user_id uuid not null references auth.users (id) on delete cascade,
    week_start date not null,
    focus_minutes int not null default 0,
    primary key (user_id, week_start)
);

-- Silent focus rooms
create table if not exists public.focus_rooms (
    id uuid primary key default gen_random_uuid(),
    host_id uuid not null references auth.users (id) on delete cascade,
    title text not null default 'Focus Room',
    duration_min int not null,
    started_at timestamptz not null default now(),
    ends_at timestamptz not null,
    is_active boolean not null default true
);

create index if not exists focus_rooms_active_idx on public.focus_rooms (is_active, ends_at);

create table if not exists public.focus_room_members (
    room_id uuid not null references public.focus_rooms (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    joined_at timestamptz not null default now(),
    primary key (room_id, user_id)
);

alter table public.friendships enable row level security;
alter table public.friend_presence enable row level security;
alter table public.weekly_focus enable row level security;
alter table public.focus_rooms enable row level security;
alter table public.focus_room_members enable row level security;

-- Helper: ISO week start (Monday)
create or replace function public.week_start_monday(d timestamptz default now())
returns date
language sql
immutable
as $$
    select (d::date - ((extract(dow from d)::int + 6) % 7));
$$;

-- ── Friend RPCs ──

create or replace function public.send_friend_request(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
    target_id uuid;
    uname text;
    fid uuid;
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    end if;

    uname := public.normalize_username(p_username);
    select id into target_id from public.profiles where username = uname limit 1;
    if target_id is null then
        return jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND');
    end if;
    if target_id = uid then
        return jsonb_build_object('ok', false, 'error', 'SELF_REQUEST');
    end if;

    if exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and ((f.requester_id = uid and f.addressee_id = target_id)
            or (f.requester_id = target_id and f.addressee_id = uid))
    ) then
        return jsonb_build_object('ok', false, 'error', 'ALREADY_FRIENDS');
    end if;

    insert into public.friendships (requester_id, addressee_id, status)
    values (uid, target_id, 'pending')
    on conflict (requester_id, addressee_id) do update set status = 'pending', created_at = now()
    returning id into fid;

    return jsonb_build_object('ok', true, 'friendship_id', fid);
end;
$$;

create or replace function public.respond_friend_request(p_friendship_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
    row public.friendships%rowtype;
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    end if;

    select * into row from public.friendships where id = p_friendship_id and addressee_id = uid;
    if not found then
        return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;

    if p_accept then
        update public.friendships set status = 'accepted' where id = p_friendship_id;
    else
        delete from public.friendships where id = p_friendship_id;
    end if;

    return jsonb_build_object('ok', true, 'accepted', p_accept);
end;
$$;

create or replace function public.list_my_friends()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
    result jsonb;
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    end if;

    select coalesce(jsonb_agg(friend_row order by friend_row ->> 'displayName'), '[]'::jsonb)
    into result
    from (
        select jsonb_build_object(
            'userId', p.id,
            'username', p.username,
            'displayName', p.display_name,
            'avatarUrl', p.avatar_url,
            'streak', coalesce((p.focus_stats ->> 'currentStreak')::int, (p.focus_stats ->> 'longestStreak')::int, 0),
            'isFocusing', coalesce(fp.is_focusing, false),
            'sessionEndsAt', fp.session_ends_at,
            'weeklyFocusMinutes', coalesce(wf.focus_minutes, 0),
            'level', coalesce((p.focus_stats ->> 'level')::int, 1)
        ) as friend_row
        from public.friendships f
        inner join public.profiles p on p.id = case when f.requester_id = uid then f.addressee_id else f.requester_id end
        left join public.friend_presence fp on fp.user_id = p.id
        left join public.weekly_focus wf on wf.user_id = p.id and wf.week_start = public.week_start_monday(now())
        where f.status = 'accepted'
          and (f.requester_id = uid or f.addressee_id = uid)
    ) sub;

    select coalesce(jsonb_agg(pending_row), '[]'::jsonb)
    into result
    from (
        select jsonb_build_object(
            'friendshipId', f.id,
            'username', p.username,
            'displayName', p.display_name,
            'avatarUrl', p.avatar_url
        ) as pending_row
        from public.friendships f
        inner join public.profiles p on p.id = f.requester_id
        where f.addressee_id = uid and f.status = 'pending'
    ) pending;

    -- Rebuild properly with friends + pending
    select jsonb_build_object(
        'ok', true,
        'friends', coalesce((
            select jsonb_agg(fr order by fr ->> 'displayName')
            from (
                select jsonb_build_object(
                    'userId', p.id,
                    'username', p.username,
                    'displayName', p.display_name,
                    'avatarUrl', p.avatar_url,
                    'streak', coalesce((p.focus_stats ->> 'currentStreak')::int, (p.focus_stats ->> 'longestStreak')::int, 0),
                    'isFocusing', coalesce(fp.is_focusing, false),
                    'sessionEndsAt', fp.session_ends_at,
                    'weeklyFocusMinutes', coalesce(wf.focus_minutes, 0),
                    'level', coalesce((p.focus_stats ->> 'level')::int, 1)
                ) as fr
                from public.friendships f
                inner join public.profiles p on p.id = case when f.requester_id = uid then f.addressee_id else f.requester_id end
                left join public.friend_presence fp on fp.user_id = p.id
                left join public.weekly_focus wf on wf.user_id = p.id and wf.week_start = public.week_start_monday(now())
                where f.status = 'accepted' and (f.requester_id = uid or f.addressee_id = uid)
            ) friends_sub
        ), '[]'::jsonb),
        'pending', coalesce((
            select jsonb_agg(pr)
            from (
                select jsonb_build_object(
                    'friendshipId', f.id,
                    'username', p.username,
                    'displayName', p.display_name,
                    'avatarUrl', p.avatar_url
                ) as pr
                from public.friendships f
                inner join public.profiles p on p.id = f.requester_id
                where f.addressee_id = uid and f.status = 'pending'
            ) pending_sub
        ), '[]'::jsonb)
    ) into result;

    return result;
end;
$$;

create or replace function public.get_friends_weekly_leaderboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
    result jsonb;
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    end if;

    select coalesce(jsonb_agg(row order by (row ->> 'weeklyFocusMinutes')::int desc), '[]'::jsonb)
    into result
    from (
        select jsonb_build_object(
            'username', p.username,
            'displayName', p.display_name,
            'avatarUrl', p.avatar_url,
            'weeklyFocusMinutes', coalesce(wf.focus_minutes, 0),
            'isMe', p.id = uid
        ) as row
        from public.friendships f
        inner join public.profiles p on p.id = case when f.requester_id = uid then f.addressee_id else f.requester_id end
        left join public.weekly_focus wf on wf.user_id = p.id and wf.week_start = public.week_start_monday(now())
        where f.status = 'accepted' and (f.requester_id = uid or f.addressee_id = uid)
        union all
        select jsonb_build_object(
            'username', me.username,
            'displayName', me.display_name,
            'avatarUrl', me.avatar_url,
            'weeklyFocusMinutes', coalesce(mwf.focus_minutes, 0),
            'isMe', true
        )
        from public.profiles me
        left join public.weekly_focus mwf on mwf.user_id = me.id and mwf.week_start = public.week_start_monday(now())
        where me.id = uid
    ) sub;

    return jsonb_build_object('ok', true, 'leaderboard', result);
end;
$$;

create or replace function public.heartbeat_focus_session(
    p_focusing boolean,
    p_ends_at timestamptz default null,
    p_focus_minutes_delta int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
    ws date := public.week_start_monday(now());
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    end if;

    insert into public.friend_presence (user_id, is_focusing, session_ends_at, updated_at)
    values (uid, coalesce(p_focusing, false), p_ends_at, now())
    on conflict (user_id) do update
    set is_focusing = coalesce(p_focusing, false),
        session_ends_at = p_ends_at,
        updated_at = now();

    if coalesce(p_focus_minutes_delta, 0) > 0 then
        insert into public.weekly_focus (user_id, week_start, focus_minutes)
        values (uid, ws, p_focus_minutes_delta)
        on conflict (user_id, week_start) do update
        set focus_minutes = public.weekly_focus.focus_minutes + excluded.focus_minutes;
    end if;

    return jsonb_build_object('ok', true);
end;
$$;

-- ── Focus Room RPCs ──

create or replace function public.create_focus_room(
    p_title text default 'Focus Room',
    p_duration_min int default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
    rid uuid;
    ends timestamptz;
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    end if;

    ends := now() + make_interval(mins => greatest(p_duration_min, 5));
    insert into public.focus_rooms (host_id, title, duration_min, ends_at)
    values (uid, coalesce(nullif(trim(p_title), ''), 'Focus Room'), greatest(p_duration_min, 5), ends)
    returning id into rid;

    insert into public.focus_room_members (room_id, user_id) values (rid, uid);

    return jsonb_build_object('ok', true, 'room_id', rid, 'ends_at', ends);
end;
$$;

create or replace function public.join_focus_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
    room public.focus_rooms%rowtype;
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    end if;

    select * into room from public.focus_rooms where id = p_room_id and is_active and ends_at > now();
    if not found then
        return jsonb_build_object('ok', false, 'error', 'ROOM_NOT_FOUND');
    end if;

    insert into public.focus_room_members (room_id, user_id) values (p_room_id, uid)
    on conflict do nothing;

    return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.leave_focus_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    end if;

    delete from public.focus_room_members where room_id = p_room_id and user_id = uid;
    return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_focus_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    room public.focus_rooms%rowtype;
    members jsonb;
    cnt int;
begin
    select * into room from public.focus_rooms where id = p_room_id;
    if not found or not room.is_active or room.ends_at <= now() then
        return jsonb_build_object('ok', false, 'error', 'ROOM_NOT_FOUND');
    end if;

    select count(*) into cnt from public.focus_room_members where room_id = p_room_id;

    select coalesce(jsonb_agg(jsonb_build_object(
        'username', p.username,
        'displayName', p.display_name,
        'avatarUrl', p.avatar_url
    )), '[]'::jsonb)
    into members
    from public.focus_room_members m
    inner join public.profiles p on p.id = m.user_id
    where m.room_id = p_room_id;

    return jsonb_build_object(
        'ok', true,
        'room', jsonb_build_object(
            'id', room.id,
            'title', room.title,
            'durationMin', room.duration_min,
            'startedAt', room.started_at,
            'endsAt', room.ends_at,
            'participantCount', cnt,
            'members', members
        )
    );
end;
$$;

grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.list_my_friends() to authenticated;
grant execute on function public.get_friends_weekly_leaderboard() to authenticated;
grant execute on function public.heartbeat_focus_session(boolean, timestamptz, int) to authenticated;
grant execute on function public.create_focus_room(text, int) to authenticated;
grant execute on function public.join_focus_room(uuid) to authenticated;
grant execute on function public.leave_focus_room(uuid) to authenticated;
grant execute on function public.get_focus_room(uuid) to authenticated;
grant execute on function public.get_focus_room(uuid) to anon;
