-- Run in Supabase SQL Editor if orders table already exists without payment fields
alter table orders add column if not exists price_php numeric(10, 2);
alter table orders add column if not exists payment_method text;
