# Expensior! (web)

## What's built in this pass
- Magic link + Google sign-in (Supabase Auth)
- Full three-zone layout: entry (Quick with live-editable preview + Detailed/edit mode), dashboard (icon rail — Patterns / Overview / Trends / Subscriptions / Reflect), ledger (month-scoped, day-grouped, OR filter chips, search, click-to-edit)
- Real Supabase-backed CRUD for transactions, categories, monthly pot, reflections
- Settings drawer (categories & budget, API key, CSV export, clear-all)
- Row-level security so your data is only ever visible to you

## Not built yet — next pass
- Gmail scan for transactions/subscriptions
- Bulk file upload (bank statement PDF/CSV) parsing
- AI-assisted categorisation actually calling the Claude API (the settings field to store your key exists; the server route to use it doesn't yet)
- Recurring transactions logic (the `repeats` field is captured in the schema and entry form, nothing acts on it yet)
- The rebuilt content script (merchant-detection popup on Swiggy/Zomato/etc. opening this site with a prefill)
- Subscription auto-flagging (the Subscriptions section reads real data but nothing writes to `flagged_subscriptions` yet)

## Setup

### 1. Supabase
1. Open your Supabase project -> SQL Editor -> paste the contents of `supabase/schema.sql` -> run it.
2. Go to Authentication -> Providers:
   - Enable Email (this gives you magic link -- make sure OTP/magic link is on).
   - Enable Google -- you'll need a Google Cloud OAuth client ID/secret; Supabase's provider page links directly to the Google Cloud steps.
3. Go to Authentication -> URL Configuration:
   - Set Site URL to your Vercel deployment URL once you have one (or `http://localhost:3000` for now).
   - Add `http://localhost:3000/auth/callback` and, later, `https://your-app.vercel.app/auth/callback` under Redirect URLs.
4. Go to Project Settings -> API and copy the Project URL and anon public key.

### 2. Local environment
```
cp .env.local.example .env.local
```
Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY with the values from step 1.4.

```
npm install
npm run dev
```
Visit http://localhost:3000 -- it should redirect you to /login.

### 3. Push to GitHub
```
git add -A
git commit -m "Initial Expensior web app"
```
Create a new repository on GitHub, then:
```
git remote add origin https://github.com/YOUR-USERNAME/expensior-web.git
git branch -M main
git push -u origin main
```

### 4. Deploy on Vercel
1. Sign into Vercel with GitHub.
2. "Add New Project" -> select the expensior-web repo.
3. Under Environment Variables, add the same two Supabase values from step 2.
4. Deploy. Once you have the live URL, go back to Supabase -> Authentication -> URL Configuration and add `https://your-app.vercel.app/auth/callback` to Redirect URLs, and update Site URL to the live domain.

## Note
middleware.ts uses the middleware convention that Next.js 16 has started deprecating in favor of a proxy.ts file. It still works today -- the build completes cleanly -- but if a future Next.js upgrade removes it entirely, this is the file to revisit.
