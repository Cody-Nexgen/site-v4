-- Friends without a profiles row showed as "FocuzNow user @user".
-- Backfill profiles from email for friendship participants, and fall back to email in list_my_friends.

INSERT INTO public.profiles (id, username, display_name, updated_at)
SELECT
  u.id,
  public.normalize_username(split_part(u.email, '@', 1)),
  split_part(u.email, '@', 1),
  now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
  AND EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.requester_id = u.id OR f.addressee_id = u.id
  )
  AND u.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles p
SET username = public.normalize_username(split_part(u.email, '@', 1)) || substr(replace(p.id::text, '-', ''), 1, 4),
    display_name = coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1))
FROM auth.users u
WHERE p.id = u.id
  AND (
    p.username IS NULL
    OR length(p.username) < 3
    OR EXISTS (
      SELECT 1 FROM public.profiles o
      WHERE o.username = p.username AND o.id <> p.id
    )
  )
  AND EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.requester_id = p.id OR f.addressee_id = p.id
  );

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
                    'level', coalesce((p.focus_stats ->> 'level')::int, 1)
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
