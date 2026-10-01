-- FocuzPass Cloud: zero-knowledge sync of the password vault (docs/focuzpass-cloud-plan.md).
--
-- The server only ever stores ciphertext plus what sync needs. It never receives the master
-- password, the Security Key, a hash of either, an unwrapped key or any item plaintext.
-- Reads and deletes need only ownership, so nobody is locked out of their own data; creating
-- or changing anything also needs Pro (an active/trialing subscription or a free Pro grant).
--
-- Local-only until reviewed and applied by the release owner.
-- Tests: supabase/tests/focuzpass_cloud_rls.sql

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Pro, by the same rule as attachments: an active or trialing subscription, or a free Pro grant.
create or replace function private.has_pro_entitlement(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
    entitled boolean := false;
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
        $query$ into entitled using p_user_id;
    end if;
    if not entitled and to_regclass('public.free_pro_grants') is not null then
        execute $query$
            select exists (
                select 1
                from public.free_pro_grants g
                where g.user_id = $1
                  and (g.expires_at is null or g.expires_at > now())
            )
        $query$ into entitled using p_user_id;
    end if;
    return entitled;
end;
$$;
-- Nobody asks about another account's plan; the write policies go through focuzpass_can_write().
revoke all on function private.has_pro_entitlement(uuid) from public, anon, authenticated;

-- May the signed-in user create or change their cloud vault right now?
create or replace function private.focuzpass_can_write()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
    select private.has_pro_entitlement(auth.uid());
$$;
revoke all on function private.focuzpass_can_write() from public, anon;
grant execute on function private.focuzpass_can_write() to authenticated;

/* ── Tables ─────────────────────────────────────────────────────────────── */

-- How to rebuild the account key: the master password (PBKDF2 with this salt) and the Security
-- Key together unwrap wrapped_account_key. secret_key_id is a random label, not derived from the key.
create table if not exists public.fp_accounts (
    user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
    format smallint not null default 1,
    kdf text not null,
    iterations integer not null,
    salt text not null,
    secret_key_id text not null,
    wrapped_account_key jsonb not null,
    recovery_wrapped_account_key jsonb,
    revision bigint not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint fp_accounts_format check (format between 1 and 1000),
    constraint fp_accounts_kdf check (kdf = 'pbkdf2-sha256'),
    constraint fp_accounts_iterations check (iterations between 100000 and 10000000),
    constraint fp_accounts_salt check (char_length(salt) between 16 and 64),
    constraint fp_accounts_secret_key_id check (char_length(secret_key_id) between 4 and 64),
    constraint fp_accounts_wrapped check (
        jsonb_typeof(wrapped_account_key) = 'object'
        and jsonb_typeof(wrapped_account_key -> 'iv') = 'string'
        and jsonb_typeof(wrapped_account_key -> 'ct') = 'string'
        and octet_length(wrapped_account_key::text) <= 4096
    ),
    constraint fp_accounts_recovery check (
        recovery_wrapped_account_key is null
        or (
            jsonb_typeof(recovery_wrapped_account_key) = 'object'
            and jsonb_typeof(recovery_wrapped_account_key -> 'iv') = 'string'
            and jsonb_typeof(recovery_wrapped_account_key -> 'ct') = 'string'
            and octet_length(recovery_wrapped_account_key::text) <= 4096
        )
    ),
    constraint fp_accounts_revision check (revision >= 1)
);

-- Vault keys, each wrapped by the account key.
create table if not exists public.fp_keys (
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    id uuid not null,
    key_version integer not null default 1,
    wrapped_key jsonb not null,
    revision bigint not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, id),
    constraint fp_keys_version check (key_version >= 1),
    constraint fp_keys_wrapped check (
        jsonb_typeof(wrapped_key) = 'object'
        and jsonb_typeof(wrapped_key -> 'iv') = 'string'
        and jsonb_typeof(wrapped_key -> 'ct') = 'string'
        and octet_length(wrapped_key::text) <= 4096
    ),
    constraint fp_keys_revision check (revision >= 1)
);

-- One row per item, vault, tag or synced setting. The content (including what kind of item it
-- is) is inside the ciphertext, bound to user, id, revision and key version by the client.
create sequence if not exists public.fp_records_seq;

create table if not exists public.fp_records (
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    id uuid not null,
    kind text not null,
    key_id uuid not null,
    key_version integer not null,
    ciphertext text not null default '',
    iv text not null default '',
    revision bigint not null,
    deleted boolean not null default false,
    server_seq bigint not null default 0,
    updated_at timestamptz not null default now(),
    primary key (user_id, id),
    foreign key (user_id, key_id) references public.fp_keys (user_id, id) on delete cascade,
    constraint fp_records_kind check (kind in ('item', 'collection', 'tag', 'setting')),
    constraint fp_records_revision check (revision >= 1),
    constraint fp_records_key_version check (key_version >= 1),
    -- 256 KB of ciphertext, as base64.
    constraint fp_records_size check (octet_length(ciphertext) <= 349528),
    -- A deleted record keeps nothing but its tombstone.
    constraint fp_records_body check (
        (deleted and ciphertext = '' and iv = '')
        or (not deleted and ciphertext <> '' and char_length(iv) between 12 and 32)
    )
);

create index if not exists fp_records_user_seq on public.fp_records (user_id, server_seq);

-- Security activity, append-only. No secrets: just what happened and when.
create table if not exists public.fp_security_events (
    id bigint generated always as identity primary key,
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    kind text not null,
    created_at timestamptz not null default now(),
    constraint fp_security_events_kind check (kind in (
        'cloud_enabled', 'cloud_deleted', 'password_changed', 'recovery_key_created',
        'recovery_key_removed', 'secret_key_rotated', 'device_added', 'device_removed'
    ))
);

create index if not exists fp_security_events_user on public.fp_security_events (user_id, created_at desc);

/* ── Triggers ───────────────────────────────────────────────────────────── */

-- Accounts: the owner never changes; each update moves the revision on by exactly one.
create or replace function private.fp_accounts_before_write()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
    if tg_op = 'UPDATE' then
        if new.user_id is distinct from old.user_id then
            raise exception 'FocuzPass: the owner of a record can''t change' using errcode = '42501';
        end if;
        if new.revision is distinct from old.revision + 1 then
            raise exception 'FocuzPass: stale revision (stored %, sent %)', old.revision, new.revision
                using errcode = 'PT409', hint = 'Pull the latest version, then write revision + 1.';
        end if;
        new.created_at := old.created_at;
    end if;
    new.updated_at := now();
    return new;
end;
$$;

-- Keys and records: ids and owner never change, revisions move on by exactly one, and the
-- server stamps updated_at (and, for records, the sync cursor).
create or replace function private.fp_keyed_before_write()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
    if tg_op = 'UPDATE' then
        if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
            raise exception 'FocuzPass: the id or owner of a record can''t change' using errcode = '42501';
        end if;
        if new.revision is distinct from old.revision + 1 then
            raise exception 'FocuzPass: stale revision (stored %, sent %)', old.revision, new.revision
                using errcode = 'PT409', hint = 'Pull the latest version, then write revision + 1.';
        end if;
    end if;
    new.updated_at := now();
    return new;
end;
$$;

-- The sync cursor comes from a sequence the client can't touch.
create or replace function private.fp_records_stamp_seq()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    new.server_seq := nextval('public.fp_records_seq');
    return new;
end;
$$;

-- At most 20,000 records per account.
create or replace function private.fp_records_cap()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    if exists (
        select 1
        from (select distinct user_id from inserted) owners
        where (select count(*) from public.fp_records r where r.user_id = owners.user_id) > 20000
    ) then
        raise exception 'FocuzPass: this vault has reached 20,000 records' using errcode = '54000';
    end if;
    return null;
end;
$$;

revoke all on function private.fp_accounts_before_write() from public, anon, authenticated;
revoke all on function private.fp_keyed_before_write() from public, anon, authenticated;
revoke all on function private.fp_records_stamp_seq() from public, anon, authenticated;
revoke all on function private.fp_records_cap() from public, anon, authenticated;

drop trigger if exists fp_accounts_before_write on public.fp_accounts;
create trigger fp_accounts_before_write
    before insert or update on public.fp_accounts
    for each row execute function private.fp_accounts_before_write();

drop trigger if exists fp_keys_before_write on public.fp_keys;
create trigger fp_keys_before_write
    before insert or update on public.fp_keys
    for each row execute function private.fp_keyed_before_write();

drop trigger if exists fp_records_before_write on public.fp_records;
create trigger fp_records_before_write
    before insert or update on public.fp_records
    for each row execute function private.fp_keyed_before_write();

drop trigger if exists fp_records_stamp_seq on public.fp_records;
create trigger fp_records_stamp_seq
    before insert or update on public.fp_records
    for each row execute function private.fp_records_stamp_seq();

drop trigger if exists fp_records_cap on public.fp_records;
create trigger fp_records_cap
    after insert on public.fp_records
    referencing new table as inserted
    for each statement execute function private.fp_records_cap();

/* ── Row-level security ─────────────────────────────────────────────────── */

alter table public.fp_accounts enable row level security;
alter table public.fp_keys enable row level security;
alter table public.fp_records enable row level security;
alter table public.fp_security_events enable row level security;

-- Accounts
drop policy if exists "FocuzPass: read own account" on public.fp_accounts;
create policy "FocuzPass: read own account" on public.fp_accounts
    for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "FocuzPass: create own account (Pro)" on public.fp_accounts;
create policy "FocuzPass: create own account (Pro)" on public.fp_accounts
    for insert to authenticated with check (user_id = (select auth.uid()) and (select private.focuzpass_can_write()));
drop policy if exists "FocuzPass: update own account (Pro)" on public.fp_accounts;
create policy "FocuzPass: update own account (Pro)" on public.fp_accounts
    for update to authenticated using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()) and (select private.focuzpass_can_write()));
drop policy if exists "FocuzPass: delete own account" on public.fp_accounts;
create policy "FocuzPass: delete own account" on public.fp_accounts
    for delete to authenticated using (user_id = (select auth.uid()));

-- Keys
drop policy if exists "FocuzPass: read own keys" on public.fp_keys;
create policy "FocuzPass: read own keys" on public.fp_keys
    for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "FocuzPass: create own keys (Pro)" on public.fp_keys;
create policy "FocuzPass: create own keys (Pro)" on public.fp_keys
    for insert to authenticated with check (user_id = (select auth.uid()) and (select private.focuzpass_can_write()));
drop policy if exists "FocuzPass: update own keys (Pro)" on public.fp_keys;
create policy "FocuzPass: update own keys (Pro)" on public.fp_keys
    for update to authenticated using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()) and (select private.focuzpass_can_write()));
drop policy if exists "FocuzPass: delete own keys" on public.fp_keys;
create policy "FocuzPass: delete own keys" on public.fp_keys
    for delete to authenticated using (user_id = (select auth.uid()));

-- Records
drop policy if exists "FocuzPass: read own records" on public.fp_records;
create policy "FocuzPass: read own records" on public.fp_records
    for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "FocuzPass: create own records (Pro)" on public.fp_records;
create policy "FocuzPass: create own records (Pro)" on public.fp_records
    for insert to authenticated with check (user_id = (select auth.uid()) and (select private.focuzpass_can_write()));
drop policy if exists "FocuzPass: update own records (Pro)" on public.fp_records;
create policy "FocuzPass: update own records (Pro)" on public.fp_records
    for update to authenticated using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()) and (select private.focuzpass_can_write()));
drop policy if exists "FocuzPass: delete own records" on public.fp_records;
create policy "FocuzPass: delete own records" on public.fp_records
    for delete to authenticated using (user_id = (select auth.uid()));

-- Security activity: read and add your own; nothing is ever edited or removed by hand.
drop policy if exists "FocuzPass: read own security activity" on public.fp_security_events;
create policy "FocuzPass: read own security activity" on public.fp_security_events
    for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "FocuzPass: record own security activity" on public.fp_security_events;
create policy "FocuzPass: record own security activity" on public.fp_security_events
    for insert to authenticated with check (user_id = (select auth.uid()));

/* ── Grants ─────────────────────────────────────────────────────────────── */

revoke all on public.fp_accounts, public.fp_keys, public.fp_records, public.fp_security_events from public, anon;
grant select, insert, update, delete on public.fp_accounts, public.fp_keys, public.fp_records to authenticated;
revoke update, delete on public.fp_security_events from authenticated;
grant select, insert on public.fp_security_events to authenticated;
revoke all on sequence public.fp_records_seq from public, anon, authenticated;
