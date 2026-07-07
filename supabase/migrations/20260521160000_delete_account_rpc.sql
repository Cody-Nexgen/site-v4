-- Ordered cleanup before auth.admin.deleteUser (avoids FK blocks on auth.users).
create or replace function public.delete_account_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_user_id is null then
        raise exception 'USER_ID_REQUIRED';
    end if;

    if to_regclass('public.subscriptions') is not null then
        delete from public.subscriptions where user_id = p_user_id;
    end if;

    delete from public.scheduling_bookings b
    using public.scheduling_links sl
    where b.link_id = sl.id
      and sl.user_id = p_user_id;

    delete from public.scheduling_bookings b
    using public.scheduling_links sl
    where b.slug = sl.slug
      and sl.user_id = p_user_id;

    delete from public.scheduling_links where user_id = p_user_id;

    if to_regclass('public.profiles') is not null then
        delete from public.profiles where id = p_user_id;
    end if;

    if to_regclass('public.ai_chat_sessions') is not null then
        delete from public.ai_chat_messages m
        using public.ai_chat_sessions s
        where m.session_id = s.id
          and s.user_id = p_user_id;

        delete from public.ai_chat_sessions where user_id = p_user_id;
    end if;
end;
$$;

revoke all on function public.delete_account_data(uuid) from public;
grant execute on function public.delete_account_data(uuid) to service_role;
