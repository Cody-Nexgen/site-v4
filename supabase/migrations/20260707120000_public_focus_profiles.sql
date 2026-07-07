-- Public focus profiles: stats synced from extension, shareable at /u/:username

alter table public.profiles
    add column if not exists public_profile_enabled boolean not null default false;

alter table public.profiles
    add column if not exists focus_stats jsonb not null default '{}'::jsonb;

create or replace function public.sync_my_focus_stats(
    p_focus_stats jsonb,
    p_public_enabled boolean default true
)
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

    update public.profiles
    set
        focus_stats = coalesce(p_focus_stats, '{}'::jsonb),
        public_profile_enabled = coalesce(p_public_enabled, false),
        updated_at = now()
    where id = uid;

    if not found then
        return jsonb_build_object('ok', false, 'error', 'PROFILE_NOT_FOUND');
    end if;

    return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.sync_my_focus_stats(jsonb, boolean) to authenticated;

create or replace function public.get_public_focus_profile(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    row public.profiles%rowtype;
    uname text;
begin
    uname := public.normalize_username(p_username);
    if length(uname) < 3 then
        return jsonb_build_object('ok', false, 'error', 'INVALID_USERNAME');
    end if;

    select * into row
    from public.profiles
    where username = uname
      and public_profile_enabled = true
    limit 1;

    if not found then
        return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;

    return jsonb_build_object(
        'ok', true,
        'profile', jsonb_build_object(
            'username', row.username,
            'displayName', row.display_name,
            'avatarUrl', row.avatar_url,
            'stats', coalesce(row.focus_stats, '{}'::jsonb)
        )
    );
end;
$$;

grant execute on function public.get_public_focus_profile(text) to anon, authenticated;
