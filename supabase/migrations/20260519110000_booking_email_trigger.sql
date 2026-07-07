-- Server-side booking email trigger (runs even if the browser never calls the edge function)
-- Requires: pg_net extension (enabled by default on Supabase hosted projects)

create extension if not exists pg_net with schema extensions;

create or replace function public.get_booking_id_for_slot(
    p_slug text,
    p_booking_date date,
    p_start_min int
)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
    select id
    from public.scheduling_bookings
    where slug = p_slug
      and booking_date = p_booking_date
      and start_min = p_start_min
    limit 1;
$$;

grant execute on function public.get_booking_id_for_slot(text, date, int) to anon, authenticated;

create or replace function public.enqueue_booking_email_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    base_url text;
    anon_key text;
begin
    base_url := coalesce(
        nullif(current_setting('app.settings.api_url', true), ''),
        'https://zbgbszatstigtbfvdfpb.supabase.co'
    );
    -- Anon key is public (same as frontend). Override via: SET app.settings.anon_key = '...' per session if needed.
    anon_key := coalesce(
        nullif(current_setting('app.settings.anon_key', true), ''),
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiZ2JzemF0c3RpZ3RiZnZkZnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNjY5NDAsImV4cCI6MjA3OTg0Mjk0MH0.6Uomu8F8qWp9bTCIwkj4yc48wZDMBT1U8efp9_M2vGw'
    );

    perform net.http_post(
        url := rtrim(base_url, '/') || '/functions/v1/scheduling-booking-notify',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', anon_key,
            'Authorization', 'Bearer ' || anon_key
        ),
        body := jsonb_build_object('bookingId', new.id::text)
    );

    return new;
exception
    when others then
        raise warning 'booking email notify failed: %', sqlerrm;
        return new;
end;
$$;

drop trigger if exists scheduling_booking_email_notify on public.scheduling_bookings;

create trigger scheduling_booking_email_notify
    after insert on public.scheduling_bookings
    for each row
    execute function public.enqueue_booking_email_notify();
