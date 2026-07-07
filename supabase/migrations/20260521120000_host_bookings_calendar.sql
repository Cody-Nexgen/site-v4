-- Return all host bookings for local calendar sync (not only unseen).
create or replace function public.get_host_bookings_for_calendar()
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
    order by b.created_at desc;
$$;

grant execute on function public.get_host_bookings_for_calendar() to authenticated;
