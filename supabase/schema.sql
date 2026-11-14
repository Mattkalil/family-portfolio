-- Database setup for the family portfolio dashboard.
-- Run once: Supabase dashboard > SQL Editor > New query > paste all of this > Run.
-- It is safe to run again; nothing is deleted.

-- 1. The activity sheet: one row per purchase or sale.
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  trade_date  date not null,
  symbol      text not null check (symbol ~ '^[A-Z0-9.\-^=]{1,15}$'),
  side        text not null check (side in ('buy', 'sell')),
  quantity    numeric not null check (quantity > 0),
  price       numeric not null check (price >= 0),         -- per share, in pounds or dollars (not pence)
  owner       text not null check (char_length(owner) between 1 and 30),
  account     text not null check (char_length(account) between 1 and 24)
);
create index if not exists transactions_symbol_idx on public.transactions (symbol);

-- 2. Corrections to how a holding is described (name, type, sector, region).
create table if not exists public.instruments (
  symbol      text primary key,
  name        text,
  type        text,
  sector      text,
  region      text,
  updated_at  timestamptz not null default now()
);

-- 3. A shared copy of recent prices, so the family does not each ask Yahoo for the same thing.
create table if not exists public.price_cache (
  symbol      text not null,
  mode        text not null,
  payload     jsonb not null,
  fetched_at  timestamptz not null default now(),
  primary key (symbol, mode)
);

-- 4. Access rules: only signed-in family members can read or change anything.
--    Nobody else can, even with the project's public key.
alter table public.transactions enable row level security;
alter table public.instruments  enable row level security;
alter table public.price_cache  enable row level security;

drop policy if exists "family can do everything" on public.transactions;
create policy "family can do everything" on public.transactions
  for all to authenticated using (true) with check (true);

drop policy if exists "family can do everything" on public.instruments;
create policy "family can do everything" on public.instruments
  for all to authenticated using (true) with check (true);

drop policy if exists "family can do everything" on public.price_cache;
create policy "family can do everything" on public.price_cache
  for all to authenticated using (true) with check (true);

revoke all on public.transactions, public.instruments, public.price_cache from anon;
grant select, insert, update, delete on public.transactions, public.instruments, public.price_cache to authenticated;
