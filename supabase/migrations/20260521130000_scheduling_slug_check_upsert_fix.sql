-- Slug availability check + upsert by slug when local id drifts (fixes FORBIDDEN on re-sync)

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
        where sl.slug = p_slug
          and sl.user_id is distinct from auth.uid()
          and (p_exclude_id is null or sl.id <> p_exclude_id)
    );
$$;

grant execute on function public.is_scheduling_slug_available(text, text) to authenticated;

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
begin
    if uid is null then
        return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
    end if;

    if exists (
        select 1
        from public.scheduling_links
        where slug = p_slug
          and user_id <> uid
          and (id <> p_id or p_id is null)
    ) then
        return jsonb_build_object('ok', false, 'error', 'SLUG_TAKEN');
    end if;

    update public.scheduling_links
    set
        slug = p_slug,
        payload = p_payload,
        active = p_active,
        updated_at = now()
    where id = p_id
      and user_id = uid;

    get diagnostics updated_count = row_count;

    if updated_count > 0 then
        return jsonb_build_object('ok', true);
    end if;

    -- Reconcile: same host, same slug, different local id
    update public.scheduling_links
    set
        id = p_id,
        slug = p_slug,
        payload = p_payload,
        active = p_active,
        updated_at = now()
    where user_id = uid
      and slug = p_slug;

    get diagnostics updated_count = row_count;

    if updated_count > 0 then
        return jsonb_build_object('ok', true);
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
    values (p_id, uid, p_slug, p_payload, p_active, now());

    return jsonb_build_object('ok', true);
exception
    when unique_violation then
        return jsonb_build_object('ok', false, 'error', 'SLUG_TAKEN');
end;
$$;

grant execute on function public.upsert_scheduling_link(text, text, jsonb, boolean) to authenticated;
