-- Expensior! schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  description text not null,
  category text not null,
  type text not null default 'expense', -- expense | saving | windfall
  indulgence boolean not null default false,
  essential boolean not null default false,
  regret boolean not null default false,
  tag text, -- Celebration | Stress | Boredom | Social | JustWanted
  notes text,
  date date not null,
  repeats text not null default 'none', -- none | weekly | monthly
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx on transactions (user_id, date desc);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  unique (user_id, name)
);

create table if not exists merchant_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant text not null,
  signal_keywords text[] not null default '{}', -- e.g. {"lunch","dinner","biryani"}
  category text not null,
  indulgence boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_pot numeric,
  claude_api_key text, -- server-side use only, never sent to the browser
  daily_prompt_hour int default 21,
  friday_digest_hour int default 18,
  updated_at timestamptz not null default now()
);

create table if not exists intentions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_key text not null, -- e.g. "2026-9"
  amount numeric not null,
  set_at timestamptz not null default now(),
  unique (user_id, month_key)
);

create table if not exists reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_label text,
  good text,
  regret text,
  wish text,
  created_at timestamptz not null default now()
);

create table if not exists flagged_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant text not null,
  amount numeric,
  flagged_at timestamptz not null default now(),
  cancelled boolean not null default false
);

-- Row Level Security: every table only ever shows the logged-in user's own rows
alter table transactions enable row level security;
alter table categories enable row level security;
alter table merchant_patterns enable row level security;
alter table settings enable row level security;
alter table intentions enable row level security;
alter table reflections enable row level security;
alter table flagged_subscriptions enable row level security;

create policy "own rows only" on transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on merchant_patterns for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on intentions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on reflections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on flagged_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seed default categories for a brand new user (call this once after first login,
-- or run manually with your own user_id after signing in the first time)
-- insert into categories (user_id, name, sort_order) values
--   ('YOUR-USER-ID', 'Food & dining', 0),
--   ('YOUR-USER-ID', 'Groceries', 1),
--   ('YOUR-USER-ID', 'Entertainment', 2),
--   ('YOUR-USER-ID', 'Travel', 3),
--   ('YOUR-USER-ID', 'Shopping', 4),
--   ('YOUR-USER-ID', 'Health & fitness', 5),
--   ('YOUR-USER-ID', 'Rent & utilities', 6),
--   ('YOUR-USER-ID', 'Subscriptions', 7),
--   ('YOUR-USER-ID', 'Transport', 8),
--   ('YOUR-USER-ID', 'Other', 9);
