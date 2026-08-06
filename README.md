# Jhul's Business

Website for Jhul's Gakuran reroll shop — order form, invoice generation, payment instructions, and verified review system with **free Supabase database**.

## Why Vercel showed a blank page

The website files (`index.html`, `css/`, `js/`, `images/`) were **never pushed to GitHub**. Only the README was committed, so Vercel had nothing to deploy.

### Fix — push all files to GitHub

```bash
git add .
git commit -m "Add website files, Vercel config, and Supabase API"
git push origin main
```

Vercel will auto-redeploy. Your site should appear at your `.vercel.app` URL within ~1 minute.

**Vercel settings:**
- Framework Preset: **Other**
- Root Directory: **.** (leave empty)
- Build Command: leave empty (static site)
- Output Directory: leave empty

---

## Free Database — Supabase Setup (5 minutes)

[Supabase](https://supabase.com) has a **free tier** (500 MB database, no credit card required).

### Step 1: Create project
1. Go to [supabase.com](https://supabase.com) → Sign up free
2. **New Project** → name it `jhuls-business`
3. Save your database password

### Step 2: Run the database schema
1. In Supabase Dashboard → **SQL Editor**
2. Paste the contents of `supabase/schema.sql` and click **Run**

### Step 3: Get your API keys
1. Supabase Dashboard → **Project Settings** → **API**
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (secret!) → `SUPABASE_SERVICE_ROLE_KEY`

### Step 4: Add to Vercel
1. Vercel Dashboard → your project → **Settings** → **Environment Variables**
2. Add:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your service role key |
| `ADMIN_PASSWORD` | your admin password (default: `jhul2026`) |

3. **Redeploy** (Deployments → ⋯ → Redeploy)

After this, orders and reviews are saved in Supabase and visible from any device in the admin panel.

---

## Facebook Reviews

**I cannot automatically scrape Facebook comments** — Facebook blocks automated access and your post link returns *"This Facebook post is no longer available"* (likely private or restricted).

**What we did instead:**
1. **Facebook embed** on the home page — shows live comments when the post is **public**
2. **Curated reviews** in `data/facebook-reviews.json` and Supabase `facebook_reviews` table
3. To show real comments: make the Facebook post **Public**, or manually copy comments into Supabase Table Editor → `facebook_reviews`

---

## Pages

| Page | URL | Purpose |
|------|-----|---------|
| Home | `/` | Landing, owner profile, Facebook reviews + embed |
| Gakuran Shop | `/gakuran` | Order form, invoice, verified reviews |
| Admin | `/admin` | Manage orders & generate review codes |

## Order Flow

1. Customer fills **Username** + **Reroll Amount** on Gakuran page
2. Clicks order button → **invoice image** generated & saved to database
3. Customer **messages Jhul on Facebook** with the invoice
4. Jhul verifies → sends QR code → customer pays
5. Jhul completes rerolls → marks order complete in **admin** → sends review code
6. Customer enters code → leaves verified review

## Links

- Facebook: https://www.facebook.com/jhulcammayo
- Telegram: https://t.me/+zT-UnUY2CDUzNDU1
- Facebook Reviews Post: https://www.facebook.com/share/p/19NVSb3cCU/

## File Structure

```
├── index.html, gakuran.html, admin.html
├── vercel.json              # Vercel static site config
├── package.json             # Supabase dependency for API routes
├── api/                     # Vercel serverless functions
│   ├── orders.js
│   ├── orders/complete.js
│   ├── review-codes/validate.js
│   └── reviews.js
├── supabase/schema.sql      # Database setup script
├── css/, js/, images/, data/
└── .env.example             # Environment variable template
```
