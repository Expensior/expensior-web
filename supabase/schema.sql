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
  theme text not null default 'dusty-rose',
  claude_api_key text, -- server-side use only, never sent to the browser
  gmail_refresh_token text, -- server-side ONLY — never selected in client-side queries
  display_name text, -- shown in the "Hello, X" greeting — falls back to email prefix if unset
  last_visited_at timestamptz, -- for the "since you were last here" summary
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

create table if not exists recurring_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null,
  category text not null,
  indulgence boolean not null default false,
  essential boolean not null default true,
  cadence text not null default 'monthly', -- monthly | weekly
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'ti-flag',
  target_amount numeric not null,
  target_date date, -- nullable — open-ended goals like an emergency fund
  achieved_at timestamptz, -- null while active; set once target is reached and confirmed
  created_at timestamptz not null default now()
);

create table if not exists goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  amount numeric not null,
  date date not null,
  created_at timestamptz not null default now()
);

-- One row per Friday/Sunday digest, generated once and then permanent —
-- period_end is the exact local-time cutoff the digest is frozen at, so it
-- never silently changes even if computed retroactively (e.g. you open the
-- app days after the boundary passed).
create table if not exists digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, -- friday | sunday
  period_end timestamptz not null,
  spent numeric not null,
  indulgence_pct numeric not null,
  top_categories jsonb not null default '[]',
  insight text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, period_end)
);

-- Row Level Security: every table only ever shows the logged-in user's own rows
alter table transactions enable row level security;
alter table categories enable row level security;
alter table merchant_patterns enable row level security;
alter table settings enable row level security;
alter table intentions enable row level security;
alter table reflections enable row level security;
alter table flagged_subscriptions enable row level security;
alter table recurring_templates enable row level security;
alter table goals enable row level security;
alter table goal_contributions enable row level security;
alter table digests enable row level security;

create policy "own rows only" on transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on merchant_patterns for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on intentions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on reflections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on flagged_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on recurring_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on goal_contributions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on digests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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

-- Migration for an already-created database (schema.sql was run before the
-- theme picker existed): run this once in the SQL editor.
-- alter table settings add column if not exists theme text not null default 'dusty-rose';

-- Migration if you already ran schema.sql before recurring templates existed:
-- create table recurring_templates (
--   id uuid primary key default gen_random_uuid(),
--   user_id uuid not null references auth.users(id) on delete cascade,
--   name text not null,
--   amount numeric not null,
--   category text not null,
--   indulgence boolean not null default false,
--   essential boolean not null default true,
--   cadence text not null default 'monthly',
--   sort_order int not null default 0,
--   created_at timestamptz not null default now()
-- );
-- alter table recurring_templates enable row level security;
-- create policy "own rows only" on recurring_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Migration if settings already exists without this column:
-- alter table settings add column if not exists gmail_refresh_token text;

-- Migration if you already ran schema.sql before Goals/Digest existed:
-- alter table settings add column if not exists last_visited_at timestamptz;
-- create table goals (
--   id uuid primary key default gen_random_uuid(),
--   user_id uuid not null references auth.users(id) on delete cascade,
--   name text not null, icon text not null default 'ti-flag',
--   target_amount numeric not null, target_date date, achieved_at timestamptz,
--   created_at timestamptz not null default now()
-- );
-- create table goal_contributions (
--   id uuid primary key default gen_random_uuid(),
--   user_id uuid not null references auth.users(id) on delete cascade,
--   goal_id uuid not null references goals(id) on delete cascade,
--   amount numeric not null, date date not null, created_at timestamptz not null default now()
-- );
-- create table digests (
--   id uuid primary key default gen_random_uuid(),
--   user_id uuid not null references auth.users(id) on delete cascade,
--   kind text not null, period_end timestamptz not null,
--   spent numeric not null, indulgence_pct numeric not null,
--   top_categories jsonb not null default '[]', insight text not null,
--   created_at timestamptz not null default now(), unique (user_id, kind, period_end)
-- );
-- alter table goals enable row level security;
-- alter table goal_contributions enable row level security;
-- alter table digests enable row level security;
-- create policy "own rows only" on goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "own rows only" on goal_contributions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "own rows only" on digests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Migration if you already ran schema.sql before the editable display name existed:
-- alter table settings add column if not exists display_name text;
