-- Cloud persistence for focus challenges (source of truth; chrome.storage is a local cache)
create table if not exists public.user_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'failed')),
  progress jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, challenge_id)
);

create index if not exists user_challenges_user_status_idx
  on public.user_challenges (user_id, status);

alter table public.user_challenges enable row level security;

drop policy if exists "Users select own challenges" on public.user_challenges;
create policy "Users select own challenges"
  on public.user_challenges
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own challenges" on public.user_challenges;
create policy "Users insert own challenges"
  on public.user_challenges
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own challenges" on public.user_challenges;
create policy "Users update own challenges"
  on public.user_challenges
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own challenges" on public.user_challenges;
create policy "Users delete own challenges"
  on public.user_challenges
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Keep updated_at accurate for direct row writes (upserts from the client also set it explicitly).
create or replace function public.set_user_challenges_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_challenges_set_updated_at on public.user_challenges;
create trigger user_challenges_set_updated_at
  before update on public.user_challenges
  for each row
  execute function public.set_user_challenges_updated_at();
