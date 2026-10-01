// Runs the FocuzPass Cloud migration and its security tests in an in-memory Postgres 17 (PGlite),
// with the few pieces of Supabase the migration relies on stubbed (auth schema, roles, the
// subscription tables). Then it breaks the migration on purpose, several ways, and checks the
// tests notice every time.
//
// PGlite isn't a project dependency. Install it anywhere and point PGLITE at it:
//   npm install --no-save --prefix "%TEMP%\pglite" @electric-sql/pglite
//   set PGLITE=%TEMP%\pglite\node_modules\@electric-sql\pglite\dist\index.js
//   node supabase/tests/run-with-pglite.mjs
// (Or, with Docker running: `supabase start`, then `supabase test db`, or psql -f the .sql file.)

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { PGlite } = await import(process.env.PGLITE ? pathToFileURL(process.env.PGLITE).href : '@electric-sql/pglite');
const migration = readFileSync(path.join(here, '../migrations/20260929180000_focuzpass_cloud.sql'), 'utf8');
const tests = readFileSync(path.join(here, 'focuzpass_cloud_rls.sql'), 'utf8');

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
-- Same lookup order as Supabase's auth.uid().
create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- Supabase gives these roles access to public by default; the migration has to take it back.
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
create table public.subscriptions (
    id bigint generated always as identity primary key,
    user_id uuid references auth.users (id) on delete cascade,
    status text,
    ended_at timestamptz
);
create table public.free_pro_grants (
    user_id uuid references auth.users (id) on delete cascade,
    expires_at timestamptz
);
`;

const RECORD_CAP = `
begin;
insert into auth.users (id) values ('dddddddd-0000-4000-8000-000000000004');
insert into public.subscriptions (user_id, status) values ('dddddddd-0000-4000-8000-000000000004', 'active');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-0000-4000-8000-000000000004', true);
insert into public.fp_keys (id, wrapped_key) values ('d0000000-0000-4000-8000-00000000000d', '{"iv":"dddddddddddddddd","ct":"a2V5"}');
insert into public.fp_records (id, kind, key_id, key_version, ciphertext, iv, revision)
select gen_random_uuid(), 'item', 'd0000000-0000-4000-8000-00000000000d', 1, 'eA==', 'dddddddddddddddd', 1 from generate_series(1, 20000);
do $$
begin
    begin
        insert into public.fp_records (id, kind, key_id, key_version, ciphertext, iv, revision)
        values (gen_random_uuid(), 'item', 'd0000000-0000-4000-8000-00000000000d', 1, 'eA==', 'dddddddddddddddd', 1);
        raise exception 'TEST FAILED: record 20,001 was accepted';
    exception when sqlstate '54000' then null;
    end;
end $$;
rollback;
`;

const UPSERTS = `
begin;
insert into auth.users (id) values ('eeeeeeee-0000-4000-8000-000000000005');
insert into public.subscriptions (user_id, status) values ('eeeeeeee-0000-4000-8000-000000000005', 'active');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-0000-4000-8000-000000000005', true);
insert into public.fp_keys (id, wrapped_key) values ('e0000000-0000-4000-8000-00000000000e', '{"iv":"eeeeeeeeeeeeeeee","ct":"a2V5"}');
insert into public.fp_records (id, kind, key_id, key_version, ciphertext, iv, revision)
values ('e0000000-0000-4000-8000-000000000501', 'item', 'e0000000-0000-4000-8000-00000000000e', 1, 'djE=', 'eeeeeeeeeeeeeeee', 1)
on conflict (user_id, id) do update set ciphertext = excluded.ciphertext, iv = excluded.iv, revision = excluded.revision, deleted = excluded.deleted;
insert into public.fp_records (id, kind, key_id, key_version, ciphertext, iv, revision)
values ('e0000000-0000-4000-8000-000000000501', 'item', 'e0000000-0000-4000-8000-00000000000e', 1, 'djI=', 'eeeeeeeeeeeeeeee', 2)
on conflict (user_id, id) do update set ciphertext = excluded.ciphertext, iv = excluded.iv, revision = excluded.revision, deleted = excluded.deleted;
do $$
begin
    begin
        insert into public.fp_records (id, kind, key_id, key_version, ciphertext, iv, revision)
        values ('e0000000-0000-4000-8000-000000000501', 'item', 'e0000000-0000-4000-8000-00000000000e', 1, 'c3RhbGU=', 'eeeeeeeeeeeeeeee', 2)
        on conflict (user_id, id) do update set ciphertext = excluded.ciphertext, iv = excluded.iv, revision = excluded.revision, deleted = excluded.deleted;
        raise exception 'TEST FAILED: a stale upsert went through';
    exception when sqlstate 'PT409' then null;
    end;
    if (select ciphertext from public.fp_records where id = 'e0000000-0000-4000-8000-000000000501') <> 'djI=' then
        raise exception 'TEST FAILED: upsert result';
    end if;
end $$;
rollback;
`;

const MUTANTS = {
    'every signed-in user counts as Pro': `create or replace function private.focuzpass_can_write() returns boolean language sql stable security definer as $$ select true $$;`,
    'records readable by anyone signed in': `drop policy "FocuzPass: read own records" on public.fp_records; create policy x on public.fp_records for select to authenticated using (true);`,
    'writes for any owner': `drop policy "FocuzPass: create own records (Pro)" on public.fp_records; create policy x on public.fp_records for insert to authenticated with check ((select private.focuzpass_can_write()));`,
    'no revision check': `create or replace function private.fp_keyed_before_write() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;`,
    'anon keeps table access': `grant select on public.fp_records, public.fp_accounts to anon; create policy anon_read on public.fp_records for select to anon using (true); create policy anon_read on public.fp_accounts for select to anon using (true);`,
    'lapsed users can delete nothing': `drop policy "FocuzPass: delete own records" on public.fp_records;`,
    'security activity editable': `grant update on public.fp_security_events to authenticated; create policy x on public.fp_security_events for update to authenticated using (true);`,
    'no cascade on account deletion': `alter table public.fp_security_events drop constraint fp_security_events_user_id_fkey;`,
};

let failed = 0;
const step = async (db, label, sql) => {
    try {
        await db.exec(sql);
        console.log(`✔ ${label}`);
    } catch (error) {
        failed++;
        console.log(`✖ ${label}: ${error.message}`);
    }
};

const db = new PGlite();
await step(db, 'Supabase stubs', SUPABASE_STUB);
await step(db, 'migration applies', migration);
await step(db, 'migration applies twice (idempotent)', migration);
await step(db, 'security tests', tests);
await step(db, 'at most 20,000 records per account', RECORD_CAP);
await step(db, 'upserts move one revision at a time', UPSERTS);
await db.close();

for (const [name, sabotage] of Object.entries(MUTANTS)) {
    const broken = new PGlite();
    await broken.exec(SUPABASE_STUB);
    await broken.exec(migration);
    await broken.exec(sabotage);
    try {
        await broken.exec(tests);
        failed++;
        console.log(`✖ the tests missed a broken migration: ${name}`);
    } catch (error) {
        console.log(`✔ catches: ${name} (${error.message.replace(/^TEST FAILED: /, '').slice(0, 70)})`);
    }
    await broken.close();
}

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
