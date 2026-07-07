-- FocuzNow public scheduling links & bookings
-- Run in Supabase SQL editor or via CLI: supabase db push

create table if not exists public.scheduling_links (
    id text primary key,
    user_id uuid references auth.users (id) on delete cascade not null,
    slug text unique not null,
    payload jsonb not null,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists scheduling_links_slug_idx on public.scheduling_links (slug);
create index if not exists scheduling_links_user_idx on public.scheduling_links (user_id);

create table if not exists public.scheduling_bookings (
    id uuid primary key default gen_random_uuid(),
    link_id text references public.scheduling_links (id) on delete cascade,
    slug text not null,
    booking_date date not null,
    start_min int not null check (start_min >= 0 and start_min < 1440),
    duration_min int not null default 30,
    guest_name text not null,
    guest_email text not null,
    guest_phone text,
    created_at timestamptz not null default now(),
    unique (slug, booking_date, start_min)
);

create index if not exists scheduling_bookings_slug_date_idx
    on public.scheduling_bookings (slug, booking_date);

alter table public.scheduling_links enable row level security;
alter table public.scheduling_bookings enable row level security;

drop policy if exists "users manage own scheduling links" on public.scheduling_links;
create policy "users manage own scheduling links"
    on public.scheduling_links
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "hosts read bookings for own links" on public.scheduling_bookings;
create policy "hosts read bookings for own links"
    on public.scheduling_bookings
    for select
    using (
        exists (
            select 1
            from public.scheduling_links sl
            where sl.slug = scheduling_bookings.slug
              and sl.user_id = auth.uid()
        )
    );

-- Public read/write via security definer RPCs below

create or replace function public.get_scheduling_link(link_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    link_row public.scheduling_links%rowtype;
    payload jsonb;
begin
    select * into link_row
    from public.scheduling_links
    where slug = link_slug
      and active = true
    limit 1;

    if not found then
        return null;
    end if;

    payload := link_row.payload;

    if payload ? 'expiresAt'
       and nullif(payload ->> 'expiresAt', '') is not null
       and (payload ->> 'expiresAt')::timestamptz < now() then
        return null;
    end if;

    return payload;
end;
$$;

create or replace function public.get_scheduling_booked_slots(
    link_slug text,
    from_date date default current_date,
    to_date date default (current_date + 90)
)
returns table (booking_date date, start_min int)
language sql
security definer
set search_path = public
as $$
    select b.booking_date, b.start_min
    from public.scheduling_bookings b
    where b.slug = link_slug
      and b.booking_date between from_date and to_date;
$$;

create or replace function public.create_scheduling_booking(
    link_slug text,
    p_booking_date date,
    p_start_min int,
    p_guest_name text,
    p_guest_email text,
    p_guest_phone text default null
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
begin
    if length(trim(p_guest_name)) < 1 or length(trim(p_guest_email)) < 3 then
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
        guest_phone
    )
    values (
        link_row.id,
        link_slug,
        p_booking_date,
        p_start_min,
        dur,
        trim(p_guest_name),
        trim(p_guest_email),
        nullif(trim(coalesce(p_guest_phone, '')), '')
    );

    if coalesce((payload ->> 'singleUse')::boolean, false) then
        update public.scheduling_links
        set active = false, updated_at = now()
        where id = link_row.id;
    end if;

    return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.get_scheduling_link(text) to anon, authenticated;
grant execute on function public.get_scheduling_booked_slots(text, date, date) to anon, authenticated;
grant execute on function public.create_scheduling_booking(text, date, int, text, text, text) to anon, authenticated;
