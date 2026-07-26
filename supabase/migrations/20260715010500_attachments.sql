-- Private, Pro-gated attachments for Lists and Focus Room chat.
-- This migration is intentionally local-only until reviewed and applied by the release owner.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.has_attachment_entitlement(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
    has_subscription boolean := false;
begin
    if p_user_id is null then
        return false;
    end if;

    if to_regclass('public.subscriptions') is not null then
        execute $query$
            select exists (
                select 1
                from public.subscriptions s
                where s.user_id = $1
                  and s.status in ('active', 'trialing')
                  and (s.ended_at is null or s.ended_at > now())
            )
        $query$ into has_subscription using p_user_id;
    end if;

    return has_subscription or exists (
        select 1
        from public.free_pro_grants g
        where g.user_id = p_user_id
          and (g.expires_at is null or g.expires_at > now())
    );
end;
$$;

revoke all on function private.has_attachment_entitlement(uuid) from public, anon;
grant execute on function private.has_attachment_entitlement(uuid) to authenticated;

create or replace function private.is_focus_room_member(p_room_id text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
    select exists (
        select 1
        from public.focus_room_members m
        where m.room_id::text = p_room_id
          and m.user_id = p_user_id
    );
$$;

revoke all on function private.is_focus_room_member(text, uuid) from public, anon;
grant execute on function private.is_focus_room_member(text, uuid) to authenticated;

create table if not exists public.attachments (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    context text not null check (context in ('list', 'room')),
    list_id text,
    room_id uuid references public.focus_rooms (id) on delete cascade,
    storage_path text not null unique,
    file_name text not null check (char_length(file_name) between 1 and 255),
    mime_type text not null check (
        mime_type in (
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'text/plain', 'text/markdown', 'text/csv',
            'application/json', 'text/javascript', 'application/javascript',
            'text/typescript', 'text/jsx', 'text/tsx', 'text/css'
        )
    ),
    size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
    extracted_text text check (extracted_text is null or octet_length(extracted_text) <= 400000),
    created_at timestamptz not null default now(),
    check (
        (context = 'list' and list_id is not null and room_id is null)
        or
        (context = 'room' and room_id is not null and list_id is null)
    )
);

create index if not exists attachments_owner_idx on public.attachments (owner_id, created_at);
create index if not exists attachments_list_idx on public.attachments (list_id) where context = 'list';
create index if not exists attachments_room_idx on public.attachments (room_id) where context = 'room';

alter table public.attachments enable row level security;

create policy "Owners and room members can view attachments"
on public.attachments
for select
to authenticated
using (
    owner_id = (select auth.uid())
    or (
        context = 'room'
        and private.is_focus_room_member(attachments.room_id::text, (select auth.uid()))
    )
);

create policy "Entitled owners can create attachments"
on public.attachments
for insert
to authenticated
with check (
    owner_id = (select auth.uid())
    and private.has_attachment_entitlement((select auth.uid()))
    and (
        (context = 'list' and list_id is not null)
        or (
            context = 'room'
            and private.is_focus_room_member(attachments.room_id::text, (select auth.uid()))
        )
    )
);

create policy "Owners can delete attachments"
on public.attachments
for delete
to authenticated
using (owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'attachments',
    'attachments',
    false,
    10485760,
    array[
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'text/markdown', 'text/csv',
        'application/json', 'text/javascript', 'application/javascript',
        'text/typescript', 'text/jsx', 'text/tsx', 'text/css'
    ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Entitled users can upload attachment objects"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.has_attachment_entitlement((select auth.uid()))
    and (
        (storage.foldername(name))[2] = 'list'
        or (
            (storage.foldername(name))[2] = 'room'
            and private.is_focus_room_member(
                (storage.foldername(name))[3],
                (select auth.uid())
            )
        )
    )
);

create policy "Attachment viewers can download objects"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'attachments'
    and exists (
        select 1
        from public.attachments a
        where a.storage_path = name
          and (
              a.owner_id = (select auth.uid())
              or (
                  a.context = 'room'
                  and private.is_focus_room_member(a.room_id::text, (select auth.uid()))
              )
          )
    )
);

create policy "Attachment owners can delete objects"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'attachments'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

grant select, insert, delete on public.attachments to authenticated;
