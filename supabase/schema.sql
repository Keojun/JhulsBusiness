-- Run this in Supabase Dashboard → SQL Editor (free tier)
-- https://supabase.com/dashboard

create table if not exists orders (
  id text primary key,
  username text not null,
  reroll_amount integer not null,
  price_php numeric(10, 2),
  payment_method text,
  customer_id uuid,
  status text not null default 'pending',
  review_code text,
  created_at timestamptz not null default now()
);

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

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  order_id text references orders(id) on delete set null,
  subject text not null default 'General',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer', 'admin')),
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table orders add constraint orders_customer_id_fkey
  foreign key (customer_id) references customers(id) on delete set null;

create table if not exists review_codes (
  code text primary key,
  order_id text not null references orders(id) on delete cascade,
  used boolean not null default false,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create table if not exists site_reviews (
  id bigint generated always as identity primary key,
  author text not null,
  text text not null,
  stars integer not null check (stars between 1 and 5),
  verified boolean not null default true,
  source text not null default 'Verified Purchase',
  created_at timestamptz not null default now()
);

create table if not exists facebook_reviews (
  id bigint generated always as identity primary key,
  author text not null,
  text text not null,
  stars integer not null default 5,
  source text not null default 'Facebook',
  verified boolean not null default true,
  created_at timestamptz not null default now()
);

-- Sample Facebook reviews (re-run after clearing test data)
insert into facebook_reviews (author, text, stars, source, verified) values
  ('Customer', 'Legit po! Fast transaction and mabait si Jhul. Highly recommended for gakuran rerolls!', 5, 'Facebook', true),
  ('Roblox Player', 'Got my rerolls quickly after payment. Very trustworthy seller, will order again.', 5, 'Facebook', true),
  ('Gakuran Buyer', 'Smooth process — message, QR, then private server. Everything went as described.', 5, 'Facebook', true),
  ('Repeat Client', 'Been ordering rerolls here multiple times. Always reliable and fair.', 5, 'Facebook', true),
  ('New Customer', 'First time buyer, was nervous but Jhul guided me through the whole process. 10/10!', 5, 'Facebook', true),
  ('Happy Gamer', 'Salamat po! Worth it yung rerolls, legit seller talaga.', 5, 'Facebook', true);

-- Disable RLS for simplicity (API uses service role key)
alter table orders enable row level security;
alter table review_codes enable row level security;
alter table site_reviews enable row level security;
alter table facebook_reviews enable row level security;
alter table customers enable row level security;
alter table customer_sessions enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Public read for reviews only (optional — API handles everything via service role)
create policy "Public read facebook reviews" on facebook_reviews for select using (true);
create policy "Public read site reviews" on site_reviews for select using (true);
