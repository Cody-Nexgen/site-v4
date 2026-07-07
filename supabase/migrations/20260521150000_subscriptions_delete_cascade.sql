-- Allow auth user deletion when a subscriptions row exists (common blocker for deleteUser).
do $$
begin
    if exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'subscriptions'
    ) then
        alter table public.subscriptions
            drop constraint if exists subscriptions_user_id_fkey;

        alter table public.subscriptions
            add constraint subscriptions_user_id_fkey
            foreign key (user_id)
            references auth.users (id)
            on delete cascade;
    end if;
exception
    when others then
        raise notice 'subscriptions cascade migration skipped: %', sqlerrm;
end $$;
