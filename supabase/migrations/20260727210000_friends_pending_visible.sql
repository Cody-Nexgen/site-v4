-- Pending friend requests were invisible when the requester had no profiles row
-- (list_my_friends used INNER JOIN). Also require sender profile on send.

CREATE OR REPLACE FUNCTION public.list_my_friends()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
    uid uuid := auth.uid();
    result jsonb;
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    end if;

    select jsonb_build_object(
        'ok', true,
        'friends', coalesce((
            select jsonb_agg(fr order by fr ->> 'displayName')
            from (
                select jsonb_build_object(
                    'userId', coalesce(p.id, case when f.requester_id = uid then f.addressee_id else f.requester_id end),
                    'username', coalesce(nullif(p.username, ''), 'user'),
                    'displayName', coalesce(nullif(p.display_name, ''), nullif(p.username, ''), 'FocuzNow user'),
                    'avatarUrl', p.avatar_url,
                    'streak', coalesce((p.focus_stats ->> 'currentStreak')::int, (p.focus_stats ->> 'longestStreak')::int, 0),
                    'isFocusing', coalesce(fp.is_focusing, false),
                    'sessionEndsAt', fp.session_ends_at,
                    'weeklyFocusMinutes', coalesce(wf.focus_minutes, 0),
                    'level', coalesce((p.focus_stats ->> 'level')::int, 1)
                ) as fr
                from public.friendships f
                left join public.profiles p on p.id = case when f.requester_id = uid then f.addressee_id else f.requester_id end
                left join public.friend_presence fp on fp.user_id = case when f.requester_id = uid then f.addressee_id else f.requester_id end
                left join public.weekly_focus wf on wf.user_id = case when f.requester_id = uid then f.addressee_id else f.requester_id end
                  and wf.week_start = public.week_start_monday(now())
                where f.status = 'accepted' and (f.requester_id = uid or f.addressee_id = uid)
            ) friends_sub
        ), '[]'::jsonb),
        'pending', coalesce((
            select jsonb_agg(pr order by pr ->> 'displayName')
            from (
                select jsonb_build_object(
                    'friendshipId', f.id,
                    'username', coalesce(nullif(p.username, ''), 'user'),
                    'displayName', coalesce(nullif(p.display_name, ''), nullif(p.username, ''), split_part(coalesce(u.email, 'someone'), '@', 1), 'FocuzNow user'),
                    'avatarUrl', p.avatar_url
                ) as pr
                from public.friendships f
                left join public.profiles p on p.id = f.requester_id
                left join auth.users u on u.id = f.requester_id
                where f.addressee_id = uid and f.status = 'pending'
            ) pending_sub
        ), '[]'::jsonb)
    ) into result;

    return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.send_friend_request(p_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
    uid uuid := auth.uid();
    target_id uuid;
    uname text;
    fid uuid;
    reverse_id uuid;
    my_username text;
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    end if;

    select username into my_username from public.profiles where id = uid;
    if my_username is null or length(trim(my_username)) < 3 then
        return jsonb_build_object('ok', false, 'error', 'PROFILE_REQUIRED');
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

    select id into reverse_id from public.friendships f
    where f.requester_id = target_id and f.addressee_id = uid and f.status = 'pending'
    limit 1;
    if reverse_id is not null then
        update public.friendships set status = 'accepted' where id = reverse_id;
        return jsonb_build_object('ok', true, 'friendship_id', reverse_id, 'auto_accepted', true);
    end if;

    if exists (
        select 1 from public.friendships f
        where f.requester_id = uid and f.addressee_id = target_id and f.status = 'pending'
    ) then
        return jsonb_build_object('ok', false, 'error', 'PENDING_EXISTS');
    end if;

    insert into public.friendships (requester_id, addressee_id, status)
    values (uid, target_id, 'pending')
    on conflict (requester_id, addressee_id) do update set status = 'pending', created_at = now()
    returning id into fid;

    return jsonb_build_object('ok', true, 'friendship_id', fid);
end;
$function$;
