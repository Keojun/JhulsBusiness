-- Run this in Supabase Dashboard → SQL Editor (free tier)
-- https://supabase.com/dashboard

create table if not exists orders (
  id text primary key,
  username text not null,
  reroll_amount integer not null,
  status text not null default 'pending',
  review_code text,
  created_at timestamptz not null default now()
);

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

-- Public read for reviews only (optional — API handles everything via service role)
create policy "Public read facebook reviews" on facebook_reviews for select using (true);
create policy "Public read site reviews" on site_reviews for select using (true);
