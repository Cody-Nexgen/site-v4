-- Expose public-profile flags on friends, and keep the weekly board limited
-- to accepted friends (plus the signed-in user) even when a profile row is thin.

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
            select jsonb_agg(fr order by lower(fr ->> 'displayName'))
            from (
                select jsonb_build_object(
                    'userId', friend_id,
                    'username', coalesce(nullif(p.username, ''), nullif(public.normalize_username(split_part(coalesce(u.email, ''), '@', 1)), ''), 'user'),
                    'displayName', coalesce(
                        nullif(p.display_name, ''),
                        nullif(p.username, ''),
                        nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
                        'FocuzNow user'
                    ),
                    'avatarUrl', p.avatar_url,
                    'streak', coalesce((p.focus_stats ->> 'currentStreak')::int, (p.focus_stats ->> 'longestStreak')::int, 0),
                    'isFocusing', coalesce(fp.is_focusing, false),
                    'sessionEndsAt', fp.session_ends_at,
                    'weeklyFocusMinutes', coalesce(wf.focus_minutes, 0),
                    'level', coalesce((p.focus_stats ->> 'level')::int, 1),
                    'publicProfileEnabled', coalesce(p.public_profile_enabled, false)
                ) as fr
                from (
                    select case when f.requester_id = uid then f.addressee_id else f.requester_id end as friend_id
                    from public.friendships f
                    where f.status = 'accepted' and (f.requester_id = uid or f.addressee_id = uid)
                ) ids
                left join public.profiles p on p.id = ids.friend_id
                left join auth.users u on u.id = ids.friend_id
                left join public.friend_presence fp on fp.user_id = ids.friend_id
                left join public.weekly_focus wf on wf.user_id = ids.friend_id
                  and wf.week_start = public.week_start_monday(now())
            ) friends_sub
        ), '[]'::jsonb),
        'pending', coalesce((
            select jsonb_agg(pr order by lower(pr ->> 'displayName'))
            from (
                select jsonb_build_object(
                    'friendshipId', f.id,
                    'username', coalesce(nullif(p.username, ''), nullif(public.normalize_username(split_part(coalesce(u.email, ''), '@', 1)), ''), 'user'),
                    'displayName', coalesce(
                        nullif(p.display_name, ''),
                        nullif(p.username, ''),
                        nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
                        'FocuzNow user'
                    ),
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

CREATE OR REPLACE FUNCTION public.get_friends_weekly_leaderboard()
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

    select coalesce(jsonb_agg(row order by (row ->> 'weeklyFocusMinutes')::int desc, lower(row ->> 'displayName')), '[]'::jsonb)
    into result
    from (
        select jsonb_build_object(
            'username', coalesce(nullif(p.username, ''), nullif(public.normalize_username(split_part(coalesce(u.email, ''), '@', 1)), ''), 'user'),
            'displayName', coalesce(
                nullif(p.display_name, ''),
                nullif(p.username, ''),
                nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
                'FocuzNow user'
            ),
            'avatarUrl', p.avatar_url,
            'weeklyFocusMinutes', coalesce(wf.focus_minutes, 0),
            'isMe', false
        ) as row
        from public.friendships f
        left join public.profiles p on p.id = case when f.requester_id = uid then f.addressee_id else f.requester_id end
        left join auth.users u on u.id = case when f.requester_id = uid then f.addressee_id else f.requester_id end
        left join public.weekly_focus wf on wf.user_id = case when f.requester_id = uid then f.addressee_id else f.requester_id end
          and wf.week_start = public.week_start_monday(now())
        where f.status = 'accepted' and (f.requester_id = uid or f.addressee_id = uid)

        union all

        select jsonb_build_object(
            'username', coalesce(nullif(me.username, ''), nullif(public.normalize_username(split_part(coalesce(meu.email, ''), '@', 1)), ''), 'user'),
            'displayName', coalesce(
                nullif(me.display_name, ''),
                nullif(me.username, ''),
                nullif(split_part(coalesce(meu.email, ''), '@', 1), ''),
                'You'
            ),
            'avatarUrl', me.avatar_url,
            'weeklyFocusMinutes', coalesce(mwf.focus_minutes, 0),
            'isMe', true
        )
        from (select uid as id) self
        left join public.profiles me on me.id = self.id
        left join auth.users meu on meu.id = self.id
        left join public.weekly_focus mwf on mwf.user_id = self.id and mwf.week_start = public.week_start_monday(now())
    ) sub;

    return jsonb_build_object('ok', true, 'leaderboard', result);
end;
$function$;
