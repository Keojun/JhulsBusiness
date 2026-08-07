-- Customer accounts, sessions, and in-app chat
-- Run in Supabase Dashboard → SQL Editor

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  roblox_username text not null,
  password_hash text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists customer_sessions (
  token text primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_sessions_customer on customer_sessions(customer_id);
create index if not exists idx_customer_sessions_expires on customer_sessions(expires_at);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  order_id text references orders(id) on delete set null,
  subject text not null default 'General',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversations_customer on conversations(customer_id);
create index if not exists idx_conversations_updated on conversations(updated_at desc);

create table if not exists messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer', 'admin')),
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_messages_conversation on messages(conversation_id, created_at);

alter table orders add column if not exists customer_id uuid references customers(id);

alter table customers enable row level security;
alter table customer_sessions enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Optional: Supabase pg_cron (Pro plan) — same cleanup without Vercel Cron:
-- select cron.schedule('cleanup-old-chats', '0 16 * * *', $$
--   delete from conversations where updated_at < now() - interval '30 days';
--   delete from customer_sessions where expires_at < now();
-- $$);
