-- Returns auth providers for an email (google, email, etc.) to block wrong sign-in method.
create or replace function public.get_sign_in_methods(p_email text)
returns text[]
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    methods text[];
begin
    if p_email is null or length(trim(p_email)) < 3 then
        return array[]::text[];
    end if;

    select coalesce(array_agg(distinct i.provider order by i.provider), array[]::text[])
    into methods
    from auth.users u
    join auth.identities i on i.user_id = u.id
    where lower(u.email) = lower(trim(p_email));

    return methods;
end;
$$;

revoke all on function public.get_sign_in_methods(text) from public;
grant execute on function public.get_sign_in_methods(text) to anon, authenticated, service_role;
