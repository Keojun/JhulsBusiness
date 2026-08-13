-- =============================================================================
-- RBXDISC — Clean today's test run (Philippines / Asia/Manila date)
-- =============================================================================
-- KEEPS:  site_reviews, facebook_reviews
-- REMOVES: orders, review_codes, messages, conversations, customer_sessions,
--          customers (created today, plus all of their orders/chats)
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run
--
-- TIP: Run PART 1 first and check the counts before running PART 2.
-- =============================================================================

-- ── PART 1: PREVIEW (safe — read only) ─────────────────────────────────────

WITH manila_today AS (
  SELECT (now() AT TIME ZONE 'Asia/Manila')::date AS d
),
test_customers AS (
  SELECT c.id, c.email, c.roblox_username, c.created_at
  FROM customers c, manila_today m
  WHERE (c.created_at AT TIME ZONE 'Asia/Manila')::date = m.d
),
test_orders AS (
  SELECT o.id, o.username, o.status, o.created_at
  FROM orders o, manila_today m
  WHERE (o.created_at AT TIME ZONE 'Asia/Manila')::date = m.d
     OR o.customer_id IN (SELECT id FROM test_customers)
),
test_conversations AS (
  SELECT cv.id, cv.subject, cv.order_id, cv.created_at
  FROM conversations cv
  WHERE cv.customer_id IN (SELECT id FROM test_customers)
     OR cv.order_id IN (SELECT id FROM test_orders)
     OR (cv.created_at AT TIME ZONE 'Asia/Manila')::date = (SELECT d FROM manila_today)
)
SELECT 'customers (today)' AS item, count(*)::text AS count FROM test_customers
UNION ALL SELECT 'orders (today + test customers)', count(*)::text FROM test_orders
UNION ALL SELECT 'conversations', count(*)::text FROM test_conversations
UNION ALL SELECT 'messages', count(*)::text
  FROM messages WHERE conversation_id IN (SELECT id FROM test_conversations)
UNION ALL SELECT 'review_codes', count(*)::text
  FROM review_codes WHERE order_id IN (SELECT id FROM test_orders)
UNION ALL SELECT 'customer_sessions', count(*)::text
  FROM customer_sessions WHERE customer_id IN (SELECT id FROM test_customers)
UNION ALL SELECT '── KEPT ── site_reviews', count(*)::text FROM site_reviews
UNION ALL SELECT '── KEPT ── facebook_reviews', count(*)::text FROM facebook_reviews;

-- Optional: see exactly which accounts would be removed
-- SELECT email, roblox_username, created_at AT TIME ZONE 'Asia/Manila' AS created_manila
-- FROM customers
-- WHERE (created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
-- ORDER BY created_at;


-- ── PART 2: DELETE (run only after preview looks correct) ───────────────────
-- Supabase will warn: "destructive operations" — that is EXPECTED. Click Run anyway.
-- (No temp tables — avoids the extra "Row Level Security" warning.)
--
-- Uncomment the block below, then run it.

/*
BEGIN;

-- 1) Chat messages
DELETE FROM messages
WHERE conversation_id IN (
  SELECT cv.id FROM conversations cv
  WHERE cv.customer_id IN (
      SELECT id FROM customers
      WHERE (created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
    )
    OR cv.order_id IN (
      SELECT o.id FROM orders o
      WHERE (o.created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
         OR o.customer_id IN (
           SELECT id FROM customers
           WHERE (created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
         )
    )
    OR (cv.created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
);

-- 2) Chat threads
DELETE FROM conversations
WHERE customer_id IN (
    SELECT id FROM customers
    WHERE (created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
  )
  OR order_id IN (
    SELECT o.id FROM orders o
    WHERE (o.created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
       OR o.customer_id IN (
         SELECT id FROM customers
         WHERE (created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
       )
  )
  OR (created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date;

-- 3) Review codes (site_reviews is NOT deleted)
DELETE FROM review_codes
WHERE order_id IN (
  SELECT o.id FROM orders o
  WHERE (o.created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
     OR o.customer_id IN (
       SELECT id FROM customers
       WHERE (created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
     )
);

-- 4) Orders / transactions
DELETE FROM orders
WHERE (created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
   OR customer_id IN (
     SELECT id FROM customers
     WHERE (created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
   );

-- 5) Login sessions
DELETE FROM customer_sessions
WHERE customer_id IN (
  SELECT id FROM customers
  WHERE (created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date
);

-- 6) Customer accounts created today
DELETE FROM customers
WHERE (created_at AT TIME ZONE 'Asia/Manila')::date = (now() AT TIME ZONE 'Asia/Manila')::date;

COMMIT;
*/


-- =============================================================================
-- ALTERNATIVE: Wipe ALL test data (entire shop reset except reviews)
-- Use only if you want zero orders/accounts/chats — not just today's.
-- =============================================================================

/*
BEGIN;

DELETE FROM messages;
DELETE FROM conversations;
DELETE FROM review_codes;
DELETE FROM orders;
DELETE FROM customer_sessions;
DELETE FROM customers;
-- site_reviews and facebook_reviews are intentionally NOT deleted

COMMIT;
*/
