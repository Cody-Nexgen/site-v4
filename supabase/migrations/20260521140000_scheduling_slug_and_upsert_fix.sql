-- Slug is globally unique: any existing row counts unless it's the link being edited.
-- Never change scheduling_links.id on update (bookings FK references link_id).

create or replace function public.is_scheduling_slug_available(
    p_slug text,
    p_exclude_id text default null
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select not exists (
        select 1
        from public.scheduling_links sl
        where lower(trim(sl.slug)) = lower(trim(p_slug))
          and (p_exclude_id is null or sl.id <> p_exclude_id)
    );
$$;

create or replace function public.upsert_scheduling_link(
    p_id text,
    p_slug text,
    p_payload jsonb,
    p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
    updated_count int;
    canonical_id text;
    norm_slug text := lower(trim(p_slug));
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    end if;

    if exists (
        select 1
        from public.scheduling_links
        where lower(trim(slug)) = norm_slug
          and id <> p_id
    ) then
        return jsonb_build_object('ok', false, 'error', 'SLUG_TAKEN');
    end if;

    update public.scheduling_links
    set
        slug = norm_slug,
        payload = p_payload,
        active = p_active,
        updated_at = now()
    where id = p_id
      and user_id = uid;

    get diagnostics updated_count = row_count;

    if updated_count > 0 then
        return jsonb_build_object('ok', true, 'id', p_id);
    end if;

    -- Same host already has this slug under a different id — update in place (do not change id).
    update public.scheduling_links
    set
        slug = norm_slug,
        payload = p_payload,
        active = p_active,
        updated_at = now()
    where user_id = uid
      and lower(trim(slug)) = norm_slug;

    get diagnostics updated_count = row_count;

    if updated_count > 0 then
        select id into canonical_id
        from public.scheduling_links
        where user_id = uid
          and lower(trim(slug)) = norm_slug
        limit 1;

        return jsonb_build_object('ok', true, 'id', canonical_id);
    end if;

    if exists (
        select 1
        from public.scheduling_links
        where id = p_id
          and user_id <> uid
    ) then
        return jsonb_build_object('ok', false, 'error', 'ID_CONFLICT');
    end if;

    insert into public.scheduling_links (id, user_id, slug, payload, active, updated_at)
    values (p_id, uid, norm_slug, p_payload, p_active, now());

    return jsonb_build_object('ok', true, 'id', p_id);
exception
    when unique_violation then
        return jsonb_build_object('ok', false, 'error', 'SLUG_TAKEN');
end;
$$;

grant execute on function public.is_scheduling_slug_available(text, text) to authenticated;
grant execute on function public.upsert_scheduling_link(text, text, jsonb, boolean) to authenticated;
