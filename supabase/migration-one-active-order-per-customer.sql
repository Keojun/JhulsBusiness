-- Optional: enforce one in-progress order per customer at the database level.
-- Run in Supabase Dashboard → SQL Editor after reviewing existing data.
--
-- If this fails, you may have customers with multiple active orders from testing —
-- void the extras first, then re-run.

CREATE UNIQUE INDEX IF NOT EXISTS orders_one_active_per_customer
ON orders (customer_id)
WHERE status IN ('awaiting_payment', 'pending', 'processing');
