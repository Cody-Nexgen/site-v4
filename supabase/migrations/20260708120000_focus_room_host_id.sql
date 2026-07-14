-- Expose host_id from focus rooms for client-side host controls.

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
            'hostId', room.host_id,
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
