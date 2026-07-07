-- Scheduling notifications, guest details, and host inbox

drop function if exists public.create_scheduling_booking(text, date, int, text, text, text);

alter table public.scheduling_bookings
    alter column guest_email drop not null;

alter table public.scheduling_bookings
    add column if not exists guest_details text,
    add column if not exists reminder_sent_at timestamptz,
    add column if not exists host_seen_at timestamptz,
    add column if not exists confirmation_sent_at timestamptz;

create or replace function public.create_scheduling_booking(
    link_slug text,
    p_booking_date date,
    p_start_min int,
    p_guest_name text,
    p_guest_email text default null,
    p_guest_phone text default null,
    p_guest_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    link_row public.scheduling_links%rowtype;
    payload jsonb;
    dur int;
    taken int;
    dow int;
    days jsonb;
    loc_type text;
    booking_id uuid;
    clean_name text;
    clean_email text;
    clean_phone text;
    clean_details text;
begin
    clean_name := trim(coalesce(p_guest_name, ''));
    clean_email := nullif(trim(coalesce(p_guest_email, '')), '');
    clean_phone := nullif(trim(coalesce(p_guest_phone, '')), '');
    clean_details := nullif(trim(coalesce(p_guest_details, '')), '');

    if length(clean_name) < 1 then
        raise exception 'INVALID_GUEST';
    end if;

    select * into link_row
    from public.scheduling_links
    where slug = link_slug
      and active = true
    for update;

    if not found then
        raise exception 'LINK_NOT_FOUND';
    end if;

    payload := link_row.payload;
    loc_type := coalesce(payload ->> 'locationType', 'link');

    if loc_type = 'phone' then
        if clean_phone is null or length(clean_phone) < 5 then
            raise exception 'INVALID_GUEST';
        end if;
    elsif loc_type = 'in_person' then
        null;
    elsif loc_type = 'custom' then
        if clean_details is null or length(clean_details) < 1 then
            raise exception 'INVALID_GUEST';
        end if;
    else
        if clean_email is null or length(clean_email) < 3 then
            raise exception 'INVALID_GUEST';
        end if;
    end if;

    if payload ? 'expiresAt'
       and nullif(payload ->> 'expiresAt', '') is not null
       and (payload ->> 'expiresAt')::timestamptz < now() then
        raise exception 'LINK_EXPIRED';
    end if;

    dur := coalesce((payload ->> 'durationMin')::int, 30);

    select count(*) into taken
    from public.scheduling_bookings
    where slug = link_slug
      and booking_date = p_booking_date
      and start_min = p_start_min;

    if taken > 0 then
        raise exception 'SLOT_TAKEN';
    end if;

    dow := extract(dow from p_booking_date)::int;

    if payload ? 'specificDates' and jsonb_array_length(payload -> 'specificDates') > 0 then
        if not (payload -> 'specificDates') @> to_jsonb(to_char(p_booking_date, 'YYYY-MM-DD')) then
            raise exception 'DATE_NOT_AVAILABLE';
        end if;
    else
        days := payload -> 'availability' -> 'days';
        if days is not null and jsonb_typeof(days) = 'array' then
            if not days @> to_jsonb(dow) then
                raise exception 'DAY_NOT_AVAILABLE';
            end if;
        end if;
    end if;

    insert into public.scheduling_bookings (
        link_id,
        slug,
        booking_date,
        start_min,
        duration_min,
        guest_name,
        guest_email,
        guest_phone,
        guest_details
    )
    values (
        link_row.id,
        link_slug,
        p_booking_date,
        p_start_min,
        dur,
        clean_name,
        clean_email,
        clean_phone,
        clean_details
    )
    returning id into booking_id;

    if coalesce((payload ->> 'singleUse')::boolean, false) then
        update public.scheduling_links
        set active = false, updated_at = now()
        where id = link_row.id;
    end if;

    return jsonb_build_object('ok', true, 'booking_id', booking_id);
end;
$$;

grant execute on function public.create_scheduling_booking(text, date, int, text, text, text, text) to anon, authenticated;

create or replace function public.get_unseen_host_bookings()
returns table (
    id uuid,
    slug text,
    booking_date date,
    start_min int,
    duration_min int,
    guest_name text,
    guest_email text,
    guest_phone text,
    guest_details text,
    link_title text,
    link_payload jsonb,
    created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
    select
        b.id,
        b.slug,
        b.booking_date,
        b.start_min,
        b.duration_min,
        b.guest_name,
        b.guest_email,
        b.guest_phone,
        b.guest_details,
        coalesce(sl.payload ->> 'title', 'Meeting') as link_title,
        sl.payload as link_payload,
        b.created_at
    from public.scheduling_bookings b
    inner join public.scheduling_links sl on sl.id = b.link_id
    where sl.user_id = auth.uid()
      and b.host_seen_at is null
    order by b.created_at asc;
$$;

grant execute on function public.get_unseen_host_bookings() to authenticated;

create or replace function public.mark_host_bookings_seen(p_booking_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'NOT_AUTHENTICATED';
    end if;

    update public.scheduling_bookings b
    set host_seen_at = now()
    from public.scheduling_links sl
    where b.link_id = sl.id
      and sl.user_id = auth.uid()
      and b.id = any (p_booking_ids)
      and b.host_seen_at is null;
end;
$$;

grant execute on function public.mark_host_bookings_seen(uuid[]) to authenticated;

create or replace function public.get_bookings_needing_reminders()
returns table (
    id uuid,
    slug text,
    booking_date date,
    start_min int,
    duration_min int,
    guest_name text,
    guest_email text,
    guest_phone text,
    guest_details text,
    link_title text,
    host_email text,
    host_name text,
    timezone text,
    location_type text,
    location_value text
)
language sql
security definer
set search_path = public
stable
as $$
    with slot_start as (
        select
            b.*,
            sl.payload,
            u.email as host_account_email,
            (
                (b.booking_date + make_interval(mins => b.start_min))::timestamp
                at time zone coalesce(sl.payload ->> 'timezone', 'UTC')
            ) as starts_at_utc
        from public.scheduling_bookings b
        inner join public.scheduling_links sl on sl.id = b.link_id
        inner join auth.users u on u.id = sl.user_id
        where b.reminder_sent_at is null
          and b.guest_email is not null
          and length(trim(b.guest_email)) >= 3
    )
    select
        s.id,
        s.slug,
        s.booking_date,
        s.start_min,
        s.duration_min,
        s.guest_name,
        s.guest_email,
        s.guest_phone,
        s.guest_details,
        coalesce(s.payload ->> 'title', 'Meeting') as link_title,
        coalesce(nullif(trim(s.payload ->> 'hostEmail'), ''), s.host_account_email) as host_email,
        coalesce(s.payload ->> 'hostName', 'Host') as host_name,
        coalesce(s.payload ->> 'timezone', 'UTC') as timezone,
        s.payload ->> 'locationType' as location_type,
        s.payload ->> 'locationValue' as location_value
    from slot_start s
    where s.starts_at_utc > now()
      and s.starts_at_utc <= now() + interval '25 hours'
      and s.starts_at_utc >= now() + interval '23 hours';
$$;

-- Service role only (edge function cron)
revoke all on function public.get_bookings_needing_reminders() from public;
grant execute on function public.get_bookings_needing_reminders() to service_role;

create or replace function public.mark_booking_reminder_sent(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.scheduling_bookings
    set reminder_sent_at = now()
    where id = p_booking_id
      and reminder_sent_at is null;
end;
$$;

revoke all on function public.mark_booking_reminder_sent(uuid) from public;
grant execute on function public.mark_booking_reminder_sent(uuid) to service_role;

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
        'host_name', coalesce(sl.payload ->> 'hostName', 'Host'),
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
    where b.id = p_booking_id;

    return result;
end;
$$;

revoke all on function public.get_booking_for_notify(uuid) from public;
grant execute on function public.get_booking_for_notify(uuid) to service_role;
