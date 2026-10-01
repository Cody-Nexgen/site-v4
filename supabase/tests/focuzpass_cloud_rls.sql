-- Security tests for supabase/migrations/20260929180000_focuzpass_cloud.sql.
-- Plain SQL: every check raises 'TEST FAILED: …' when it doesn't hold, and everything rolls back.
-- Run against a local database that has the migration applied (psql -f, or `supabase test db`).
-- Fixtures assume public.subscriptions has (user_id, status, ended_at).

begin;

-- Pro user A, Pro user B, free user C.
insert into auth.users (id) values
    ('aaaaaaaa-0000-4000-8000-000000000001'),
    ('bbbbbbbb-0000-4000-8000-000000000002'),
    ('cccccccc-0000-4000-8000-000000000003');
insert into public.subscriptions (user_id, status) values
    ('aaaaaaaa-0000-4000-8000-000000000001', 'active'),
    ('bbbbbbbb-0000-4000-8000-000000000002', 'trialing');
-- B already has a vault key, so the only thing stopping A from writing into B's vault is the policy.
insert into public.fp_keys (user_id, id, wrapped_key)
values ('bbbbbbbb-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-00000000000b', '{"iv":"bbbbbbbbbbbbbbbb","ct":"a2V5"}');

/* ── A (Pro) sets up a cloud vault ─────────────────────────────────────── */
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);

insert into public.fp_accounts (kdf, iterations, salt, secret_key_id, wrapped_account_key)
values ('pbkdf2-sha256', 600000, 'c2FsdHNhbHRzYWx0c2FsdA==', 'K1-7QX2', '{"iv":"aaaaaaaaaaaaaaaa","ct":"Y2lwaGVy"}');
insert into public.fp_keys (id, wrapped_key)
values ('a0000000-0000-4000-8000-00000000000a', '{"iv":"aaaaaaaaaaaaaaaa","ct":"a2V5"}');
insert into public.fp_records (id, kind, key_id, key_version, ciphertext, iv, revision)
values
    ('a0000000-0000-4000-8000-000000000101', 'item', 'a0000000-0000-4000-8000-00000000000a', 1, 'Y2lwaGVydGV4dA==', 'aaaaaaaaaaaaaaaa', 1),
    ('a0000000-0000-4000-8000-000000000102', 'item', 'a0000000-0000-4000-8000-00000000000a', 1, 'Y2lwaGVydGV4dA==', 'aaaaaaaaaaaaaaaa', 1);
insert into public.fp_security_events (kind) values ('cloud_enabled');

do $$
begin
    if (select count(*) from public.fp_records) <> 2 then raise exception 'TEST FAILED: A should see their 2 records'; end if;
    if (select user_id from public.fp_accounts) <> 'aaaaaaaa-0000-4000-8000-000000000001' then raise exception 'TEST FAILED: user_id defaults to the signer'; end if;
    if exists (select 1 from public.fp_records where server_seq <= 0) then raise exception 'TEST FAILED: server stamps server_seq'; end if;
end $$;

-- The server stamps the cursor, not the client.
insert into public.fp_records (id, kind, key_id, key_version, ciphertext, iv, revision, server_seq)
values ('a0000000-0000-4000-8000-000000000103', 'tag', 'a0000000-0000-4000-8000-00000000000a', 1, 'Y2lwaGVy', 'aaaaaaaaaaaaaaaa', 1, 999999999);
do $$
begin
    if (select server_seq from public.fp_records where id = 'a0000000-0000-4000-8000-000000000103') = 999999999 then
        raise exception 'TEST FAILED: a client-chosen server_seq was kept';
    end if;
end $$;

-- Writing for someone else is refused.
do $$
begin
    begin
        insert into public.fp_records (user_id, id, kind, key_id, key_version, ciphertext, iv, revision)
        values ('bbbbbbbb-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000199', 'item', 'b0000000-0000-4000-8000-00000000000b', 1, 'eA==', 'aaaaaaaaaaaaaaaa', 1);
        raise exception 'TEST FAILED: A wrote a record as B';
    exception when insufficient_privilege then null;
    end;
end $$;

-- Revisions move on by exactly one; ids and owner can't change.
do $$
declare
    before_seq bigint;
    after_seq bigint;
begin
    select server_seq into before_seq from public.fp_records where id = 'a0000000-0000-4000-8000-000000000101';
    begin
        update public.fp_records set ciphertext = 'bmV3', revision = 1 where id = 'a0000000-0000-4000-8000-000000000101';
        raise exception 'TEST FAILED: a stale revision was accepted';
    exception when sqlstate 'PT409' then null;
    end;
    begin
        update public.fp_records set ciphertext = 'bmV3', revision = 5 where id = 'a0000000-0000-4000-8000-000000000101';
        raise exception 'TEST FAILED: a skipped revision was accepted';
    exception when sqlstate 'PT409' then null;
    end;
    update public.fp_records set ciphertext = 'bmV3', revision = 2 where id = 'a0000000-0000-4000-8000-000000000101';
    select server_seq into after_seq from public.fp_records where id = 'a0000000-0000-4000-8000-000000000101';
    if after_seq <= before_seq then raise exception 'TEST FAILED: an update must move the sync cursor on'; end if;
    begin
        update public.fp_records set id = 'a0000000-0000-4000-8000-000000000999', revision = 3 where id = 'a0000000-0000-4000-8000-000000000101';
        raise exception 'TEST FAILED: a record id changed';
    exception when insufficient_privilege then null;
    end;
end $$;

-- Tombstones carry nothing; live records must carry ciphertext; oversized ones are refused.
do $$
begin
    update public.fp_records set deleted = true, ciphertext = '', iv = '', revision = 2 where id = 'a0000000-0000-4000-8000-000000000102';
    begin
        update public.fp_records set deleted = true, revision = 2 where id = 'a0000000-0000-4000-8000-000000000103';
        raise exception 'TEST FAILED: a tombstone kept its ciphertext';
    exception when check_violation then null;
    end;
    begin
        insert into public.fp_records (id, kind, key_id, key_version, ciphertext, iv, revision)
        values ('a0000000-0000-4000-8000-000000000104', 'item', 'a0000000-0000-4000-8000-00000000000a', 1, repeat('A', 349529), 'aaaaaaaaaaaaaaaa', 1);
        raise exception 'TEST FAILED: an oversized record was accepted';
    exception when check_violation then null;
    end;
    begin
        insert into public.fp_records (id, kind, key_id, key_version, ciphertext, iv, revision)
        values ('a0000000-0000-4000-8000-000000000105', 'password', 'a0000000-0000-4000-8000-00000000000a', 1, 'eA==', 'aaaaaaaaaaaaaaaa', 1);
        raise exception 'TEST FAILED: an unknown record kind was accepted';
    exception when check_violation then null;
    end;
end $$;

-- Security activity is append-only.
do $$
declare
    changed integer;
begin
    update public.fp_security_events set kind = 'cloud_deleted';
    raise exception 'TEST FAILED: security activity was edited';
exception when insufficient_privilege then null;
end $$;

/* ── B (Pro) can't see or touch A's vault ─────────────────────────────── */
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000002', true);

do $$
declare
    changed integer;
begin
    if (select count(*) from public.fp_accounts where user_id = 'aaaaaaaa-0000-4000-8000-000000000001') <> 0
        or (select count(*) from public.fp_keys where user_id = 'aaaaaaaa-0000-4000-8000-000000000001') <> 0
        or (select count(*) from public.fp_records where user_id = 'aaaaaaaa-0000-4000-8000-000000000001') <> 0
        or (select count(*) from public.fp_security_events where user_id = 'aaaaaaaa-0000-4000-8000-000000000001') <> 0
        or (select count(*) from public.fp_keys) <> 1 then
        raise exception 'TEST FAILED: B can read A''s rows';
    end if;
    update public.fp_records set revision = revision + 1 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'TEST FAILED: B updated A''s records'; end if;
    delete from public.fp_records where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'TEST FAILED: B deleted A''s records'; end if;
    delete from public.fp_accounts where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'TEST FAILED: B deleted A''s account'; end if;
end $$;

-- B's own vault can't point at A's key.
do $$
begin
    begin
        insert into public.fp_records (id, kind, key_id, key_version, ciphertext, iv, revision)
        values ('b0000000-0000-4000-8000-000000000201', 'item', 'a0000000-0000-4000-8000-00000000000a', 1, 'eA==', 'bbbbbbbbbbbbbbbb', 1);
        raise exception 'TEST FAILED: B used A''s key';
    exception when foreign_key_violation then null;
    end;
end $$;

/* ── C (free) can't create a cloud vault ─────────────────────────────── */
select set_config('request.jwt.claim.sub', 'cccccccc-0000-4000-8000-000000000003', true);
do $$
begin
    begin
        insert into public.fp_accounts (kdf, iterations, salt, secret_key_id, wrapped_account_key)
        values ('pbkdf2-sha256', 600000, 'c2FsdHNhbHRzYWx0c2FsdA==', 'K1-FREE', '{"iv":"cccccccccccccccc","ct":"eA=="}');
        raise exception 'TEST FAILED: a free user created a cloud vault';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into public.fp_keys (id, wrapped_key) values ('c0000000-0000-4000-8000-00000000000c', '{"iv":"cccccccccccccccc","ct":"a2V5"}');
        raise exception 'TEST FAILED: a free user stored a key';
    exception when insufficient_privilege then null;
    end;
end $$;

/* ── Signed out: nothing at all ─────────────────────────────────────── */
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
    begin
        perform count(*) from public.fp_records;
        raise exception 'TEST FAILED: anon can query records';
    exception when insufficient_privilege then null;
    end;
    begin
        perform count(*) from public.fp_accounts;
        raise exception 'TEST FAILED: anon can query accounts';
    exception when insufficient_privilege then null;
    end;
end $$;

/* ── A's subscription lapses: read and delete, but no writes ───────────── */
reset role;
update public.subscriptions set status = 'canceled', ended_at = now() - interval '1 day'
where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);
do $$
declare
    changed integer;
begin
    if (select count(*) from public.fp_records) <> 3 then raise exception 'TEST FAILED: a lapsed user must still read their records'; end if;
    begin
        insert into public.fp_records (id, kind, key_id, key_version, ciphertext, iv, revision)
        values ('a0000000-0000-4000-8000-000000000106', 'item', 'a0000000-0000-4000-8000-00000000000a', 1, 'eA==', 'aaaaaaaaaaaaaaaa', 1);
        raise exception 'TEST FAILED: a lapsed user added a record';
    exception when insufficient_privilege then null;
    end;
    begin
        update public.fp_records set ciphertext = 'bGFwc2Vk', revision = 3 where id = 'a0000000-0000-4000-8000-000000000101';
        raise exception 'TEST FAILED: a lapsed user changed a record';
    exception when insufficient_privilege then null;
    end;
    begin
        update public.fp_accounts set iterations = 700000, revision = 2;
        raise exception 'TEST FAILED: a lapsed user changed their account';
    exception when insufficient_privilege then null;
    end;
    delete from public.fp_records where id = 'a0000000-0000-4000-8000-000000000103';
    get diagnostics changed = row_count;
    if changed <> 1 then raise exception 'TEST FAILED: a lapsed user must be able to delete their records'; end if;
end $$;

-- A free Pro grant counts as Pro.
reset role;
insert into public.free_pro_grants (user_id, expires_at) values ('aaaaaaaa-0000-4000-8000-000000000001', now() + interval '30 days');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);
update public.fp_records set ciphertext = 'Z3JhbnQ=', revision = 3 where id = 'a0000000-0000-4000-8000-000000000101';

/* ── Deleting the account removes everything ────────────────────────── */
reset role;
delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001';
do $$
begin
    if exists (select 1 from public.fp_accounts where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')
        or exists (select 1 from public.fp_keys where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')
        or exists (select 1 from public.fp_records where user_id = 'aaaaaaaa-0000-4000-8000-000000000001')
        or exists (select 1 from public.fp_security_events where user_id = 'aaaaaaaa-0000-4000-8000-000000000001') then
        raise exception 'TEST FAILED: account deletion left FocuzPass rows behind';
    end if;
end $$;

select 'focuzpass_cloud_rls: all checks passed' as result;

rollback;
