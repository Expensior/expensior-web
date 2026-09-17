# Expensior! — Project Handoff

This document exists because the previous chat session hit its image limit and
couldn't keep debugging visually. Everything here is written so a **new chat,
with zero conversation history**, can pick this project up and be immediately
useful. Read this whole file before touching code.

## What Expensior! is

A privacy-first personal expense tracker for the Indian market (₹, Swiggy/
Zomato/IRCTC-style merchants). Philosophy: **awareness without guilt** — no
judgment on essentials, no shaming language anywhere in the UI. Started as a
Chrome extension (v1.0 shipped), now rebuilt as a hosted web app.

Live at `expensior-web.vercel.app`. Solo developer: Pawas, on a managed
Deloitte Windows machine (OneDrive-rooted), non-professional developer relying
on Claude for essentially all implementation.

## Architecture

- **Next.js 16** (App Router), TypeScript, Tailwind CSS
- **Supabase**: Postgres + Auth (magic link + Google OAuth) + Row Level Security
- **Hosting**: Vercel, auto-deploys on push to `main`
- **GitHub**: `github.com/Expensior/expensior-web`, public repo
- Extension platform (separate codebase, see below): Chrome Manifest V3

### File map (key files only)
```
app/
  globals.css              - theme CSS vars, text-scale system, category colors
  page.tsx / layout.tsx
  login/page.tsx
  auth/callback/route.ts        - Supabase auth callback
  auth/gmail-callback/route.ts  - Gmail OAuth callback
  api/scan-receipt/route.ts           - Claude vision receipt OCR
  api/gmail-scan/route.ts             - Gmail transaction import
  api/gmail-scan-subscriptions/route.ts - Gmail subscription detection (NEW)
  api/gmail-status/route.ts
  api/categorize-merchant/route.ts    - Claude-based categorization (NEW)
components/
  App.tsx           - root state container, ALL Supabase calls live here
  EntryFab.tsx       - the "+" add-expense tray (6 input methods)
  Dashboard.tsx      - 5-section rail (Overview/Patterns/Self-knowledge+Subs/Reflect+Digest/Goals)
  Ledger.tsx         - monthly transaction list
  SettingsDrawer.tsx - right-edge slide-out settings
  GoalMountain.tsx, SegmentedTabs.tsx, EntryZone.tsx
lib/
  types.ts, categories.ts, parse.ts, themes.ts, goals.ts, selfKnowledge.ts, digest.ts
  globalMerchants.ts    (NEW) - shared cross-user merchant lookup/contribute
  smartCategorize.ts    (NEW) - orchestrates local → global → AI categorization
supabase/schema.sql - full schema + append-only migration comments at the bottom
```

**Critical pattern**: `App.tsx` owns ALL state and ALL Supabase calls. Every
other component is presentational — it receives data and callbacks as props.
When adding a feature, the handler always goes in `App.tsx` first, then gets
threaded down through props. This has been the pattern for the entire build;
don't break it by putting Supabase calls in child components (with the sole
exception of `EntryFab.tsx`'s Gmail OAuth `connect()` call, which needs the
browser client directly for the redirect flow).

## Database

Full schema in `supabase/schema.sql`. **The file is append-only** — every new
column/table gets added both to the main `create table` statements (for a
brand new database) AND as a commented-out migration block at the bottom (for
an existing database that needs to catch up). This has caused real user
friction multiple times this build: the code ships expecting a column that
doesn't exist in the actual live database yet, producing "column X does not
exist" errors. **Always check whether the live Supabase database has caught
up with schema.sql before assuming a feature is broken** — this has been the
actual cause of several "bugs" that were really just un-run migrations.

Tables: `transactions`, `categories`, `merchant_patterns`, `settings`,
`intentions`, `reflections`, `flagged_subscriptions`, `recurring_templates`,
`goals`, `goal_contributions`, `digests`, `feedback`, and
`global_merchant_patterns` (see below — this one is structurally different).

### `global_merchant_patterns` — deliberately different from every other table
Every other table is scoped to `auth.uid() = user_id` via RLS. This one has
**no `user_id` column at all** and open read/write RLS for any authenticated
user — it's genuinely shared knowledge across the whole user base (one
person's merchant correction helps everyone). **Known, accepted limitation**:
there is no moderation layer. Any signed-in user can write anything. This was
a deliberate scope tradeoff, not an oversight — a real voting/moderation
system was out of scope for this pass.

### Migration status as of this handoff
The most recent migration block a user needs to run (if their DB predates
this session) is at the very bottom of `schema.sql` — creates
`global_merchant_patterns`, adds `settings.text_size`. **A user reported this
exact error mid-session**: `column settings.text_size does not exist` — they
were given the migration SQL directly in chat; it's unclear whether it was
run before this handoff was written. **Check this first if anything Settings-
related is broken.**

## Design system

- **Theme**: CSS custom properties on `:root`, switchable via
  `document.documentElement.setAttribute('data-theme', id)`. 11 themes defined
  in `lib/themes.ts`. Category colors (`--cat-1` through `--cat-5`) are
  derived via `color-mix()` formulas, NOT set per-theme — this was a fix for
  an earlier bug where category colors collided with semantic role colors
  across multiple themes. Verified collision-free numerically across all 11
  themes at the time.
- **Text scale** (NEW this session): `--text-offset` CSS variable, set via
  `data-text-size="compact|default|large"` on `<html>`. **Additive, not
  multiplicative** (-1px / 0px / +3px) — a multiplier would make an 8px badge
  vanish in Compact or a 32px number explode in Large. Every text size in the
  app was scripted-replaced from `text-[Npx]` / `text-sm` etc. to `.text-sc-N`
  classes defined in `globals.css`, each using `font-size: max(8px, Npx +
  var(--text-offset))` — the `max(8px, ...)` floor prevents anything from
  shrinking below 8px regardless of offset. **This has not been visually
  confirmed live** — see Open Issues below, this is the top suspect for the
  "blank Overview box" bug.
- **Icons**: Tabler icons (`@tabler/icons-react`) throughout, no exceptions
  currently. A custom hand-drawn icon style was tried once for two dashboard
  cards and explicitly rejected by the user ("don't like the icons
  redesigned") — reverted to Tabler. Don't reintroduce custom icon styles
  without being asked again.
- **Tier system**: Tier 1 (always available) / Tier 2 (Gmail-gated) / Tier 3
  (Claude API key-gated). Displayed as a status list in Settings using the
  ORIGINAL Chrome extension's tier names ("Getting a feel" / "Getting
  curious" / "Master of my domain") — the user explicitly liked those names
  but rejected manual toggle switches (the extension had them; the web app
  shows real status instead, since a fake toggle that doesn't reflect actual
  Gmail/API-key state would be dishonest). Also explicitly noted: the tiers
  are NOT strictly sequential in the new architecture (Scan/Tier 3 doesn't
  require Gmail/Tier 2 first) — unlike the old extension.

## Feature inventory

### Built AND visually confirmed working (screenshots seen)
- Full Ledger redesign: gradient donut (budget %), unified month nav (arrows
  + jump pills, single row after an earlier redundant-two-controls bug was
  fixed), 3 highlight boxes (biggest expense / most frequent category /
  busiest day), sparkline, collapsed filters with badge count, "Today"
  labeling, weekly dividers, regret marker, proportional daily-fill on rows
- FAB tray opening at full size (after two rounds of a real positioning bug —
  see Open Issues history below for why `position: fixed` was chosen over
  `position: absolute`)
- Settings: Tiers status section, category reorder/rename, notification
  toggles (Friday digest / Sunday wrap — Daily Prompt was built then fully
  removed per explicit request), error reporting, manual subscription
  flagging, toggle switch with explicit checkmark (not just color) for on/off
  clarity

### Built, structurally sound (compiles), NOT yet visually confirmed
- **Mobile portrait layout** (this session, large piece of work): Ledger
  moved into a slide-in drawer from the right (hamburger icon, top-left of
  header on mobile), Settings kept as its existing right-drawer pattern but
  now definitively on top of the Ledger drawer via z-index (Ledger backdrop
  z-20/panel z-30, Settings backdrop z-40/panel z-50 — unchanged, this
  ordering was already correct for the new requirement). Dashboard's left
  icon rail is `hidden md:flex`; a new bottom tab bar (`md:hidden`) mirrors
  the same 5 sections with shortened labels ("Insights" for
  Self-knowledge+Subscriptions, etc. — the full labels are too long for a
  narrow tab). FAB gets more bottom clearance on mobile (`bottom-20` vs
  `bottom-5`) to clear the new tab bar, and hides entirely while the Ledger
  drawer is open (floating over an open ledger didn't make sense). Sign Out
  moved from the header into Settings as the first item, for both mobile AND
  desktop — this was a mobile-specific instruction but applying it everywhere
  avoids having two different Sign Out locations depending on screen size.
  Multi-column layouts in Patterns/Trends stack to one column below `md:`.
  Dashboard's own card styling (border/rounded corners/shadow) is stripped on
  mobile for a full-bleed feel, restored at `md:`.
- **None of this has been seen on an actual phone or resized browser window.**
  Everything here was verified by reading the Tailwind breakpoint logic
  carefully and confirming a clean build — not by visual inspection at a
  narrow viewport. This is the single biggest "needs verification" item in
  this whole document. Test at minimum: a real phone in portrait, and a
  desktop browser resized narrow (Chrome DevTools device toolbar). Specific
  things to check first: does the Ledger drawer actually cover the full
  screen height correctly, does the FAB fully clear the bottom tab bar with
  no visual overlap, do the bottom tab bar's shortened labels fit without
  wrapping/truncating oddly, and does the SegmentedTabs component (used
  inside Patterns/Self-knowledge/Reflect/Goals) fit two tabs side by side on
  the narrowest phones (~320px wide) given its `minWidth: 108` per tab.
- **One real bug was caught and fixed while re-reading this code before
  shipping**: the mobile Ledger drawer wrapper wasn't `flex flex-col`. Adding
  the mobile-only "Back" button as a sibling before `<Ledger>` (which
  internally demands `h-full`) meant two children competing for height in a
  plain block container — the Back button took its natural height, but
  Ledger's `h-full` still tried to claim 100% of the wrapper regardless,
  which would have pushed the bottom of the ledger content below the visible
  area. This worked fine before only because `<Ledger>` was the sole child.
  Fixed by making the wrapper `flex flex-col`, the Back button `shrink-0`,
  and wrapping `<Ledger>` in its own `flex-1 min-h-0` div. **Still worth
  confirming live** that the ledger list actually scrolls correctly within
  its bounds on a real mobile viewport, since this class of bug is exactly
  the kind that looks fine reading the code but needs an actual render to be
  sure.
- Landscape mobile orientation was explicitly NOT addressed — only portrait
  was requested this round.
- **Mobile scroll-passthrough bug (found and fixed)**: touching the Ledger
  drawer's static header content (donut, highlights, search, sparkline) did
  nothing, while touching the transaction list scrolled normally — because
  only the transaction list has `overflow-auto`; everything above it is
  static, non-scrolling content. A touch-scroll gesture starting over content
  with nothing to scroll can fall through to whatever's behind it in the
  visual stack (the Dashboard), since a `position: fixed` element doesn't
  block scroll-chaining by default. Fixed by adding `overscroll-contain`
  (`overscroll-behavior: contain`) to the drawer's outer wrapper. Not yet
  confirmed live.
- **Sticky day-header horizontal gap — FINAL fix, precisely computed rather
  than guessed.** Two earlier attempts at this were wrong in instructive
  ways: the first tried matching the header's margin to the transaction
  row's own `-mx-1.5`, which seemed reasonable but didn't work, because the
  row's *visible* color mostly comes from a separate absolutely-positioned
  fill overlay (`left:0; width:fillPct%`), not the row's own border-box
  background — so matching the row's margin wasn't actually matching what
  produces the row's visible color. The second attempt just widened the
  header's margin arbitrarily (`-mx-3`), which was still a guess. **The
  actual fix**: traced the full accumulated inset precisely — the Ledger
  panel has `p-4` (16px) and the scroll container has its own `-mx-1 px-1.5`
  (net +2px inset), for a total of 18px between the panel's true edge and
  where content normally starts. Both the header AND the transaction rows
  now use the identical `-mx-[18px] px-5` — canceling that exact 18px to
  reach the panel's true edge, with `px-5` (20px) restoring the text's
  visual position so it doesn't shift. Applying the *same* value to both
  elements (rather than independently-derived values that happen to differ)
  guarantees they align with each other structurally, not by coincidence.
  **If the Ledger panel's own padding (`p-4` in `App.tsx`) or the scroll
  container's `-mx-1 px-1.5` ever changes, this 18px figure must be
  recomputed and updated in both places** — it is not automatically
  responsive to those values changing, which is a real fragility worth
  knowing about. A fully responsive version would compute this via a shared
  CSS custom property or restructure so the bleed only needs to be defined
  once, but that wasn't done here given time constraints.
- **AI-assisted categorization + collective knowledge** (this session): local
  keyword hints → shared `global_merchant_patterns` lookup → Claude API call
  (only if user has a key set) → result written back to the shared table.
  Wired into Voice/SMS/CSV/Scan/Gmail import flows. Verified via isolated
  logic tests that local hits never touch the network and that merchant-key
  normalization is consistent. **Never seen running against a real Gmail
  inbox or real Claude API key.**
- **Gmail subscription detection** (this session): dedicated search query
  (avoids the bare word "subscription" — too promo-prone), extracts merchant
  name via a NEW `extractSubscriptionMerchant()` function (subscription
  subject lines put the merchant FIRST, unlike bank alerts — this required
  writing a completely different extractor, not reusing the bank-alert one).
  Two real bugs were caught and fixed during testing (see Testing Notes
  below). **Never run against a real inbox.**
- **Text-size control (A-/Default/A+)**: see Design System above. Math
  verified by hand, never seen live.
- **Recurring template editing** (this session, in direct response to a bug
  report): inline edit form matching the category-rename pattern.

### Explicitly deferred (do not build unless asked)
- Mobile responsive layout — user said explicitly: "after fixing current
  desktop issues." Confirmed broken early in the build, untouched since.
- Right-click context menu / page-capture content script — **this is a
  DIFFERENT CODEBASE** (the Chrome extension: manifest.json, background.js,
  content.js), not this Next.js repo. User asked for this to be built; it was
  not started because it requires switching to a different artifact entirely.
  This is the single largest deferred item.

### Backlog, not expected yet
Occasion intelligence, "Future Me" letter, peer benchmarks, WhatsApp Business
parsing, Android SMS forwarding — all originally scoped as "V2 onward."

## OPEN ISSUES — reported in the message that triggered this handoff

These were reported via text description only (user has hit the image limit
for this chat). Fixes below were made based on reading the code, NOT visual
confirmation. **Verify all of these live before considering them closed.**

1. **"Text overlap" has now been reported three times, describing THREE DIFFERENT bugs** — worth being precise about this for whoever continues this project, since reusing the same vague phrase made it easy to conflate them:
   - **Bug A (Ledger sticky day-header, ghosting)**: the "Today" header had a 92%-transparent background, so scrolled content showed through underneath it. Fixed by making the background opaque.
   - **Bug B (Ledger highlight boxes)**: the "17 Sept" value inside the "Busiest day" box ran into the decorative icon in the corner, since the icon is absolutely positioned and doesn't reserve space in normal text flow, and the value lacked `truncate` unlike its sibling box. Fixed by adding `truncate` to all three boxes and shrinking the icons.
   - **Bug C (Ledger sticky day-header, spacing — found via a clear screenshot this round)**: "BAKERS' HARVEST -₹240" directly overlapping "THU, 17 SEPT / ₹2,072" — these belong to the *same* day group. This is the classic limitation of per-group `position: sticky` headers: once stuck at the top of the scroll container, a header doesn't automatically reserve space below itself for its own group's first row. With no margin, zero clearance. Fixed by adding `mb-1.5` and an explicit `z-10`.
   - **All three fixes are distinct and all still in the code** — none superseded another. If "text overlap" gets reported a fourth time, get a screenshot before assuming it's one of these three recurring; it could easily be a fourth distinct location.

2. **"Overview section is one big blank box" — ROOT CAUSE CONFIRMED, not just a guess.** The category-split card had `flex-1 flex flex-col justify-center` — meaning it stretched to fill ALL remaining vertical space in the tab, then centered its actual content (a short bar + one sentence + legend) within that oversized box. This produces exactly the reported symptom: a small amount of real content floating in a sea of empty background, reading as "one graphic, otherwise devoid of anything." The "September so far" trend strip visible at the very bottom of the screenshot was real, correctly-rendered content — just visually stranded below all that dead space. Fixed by removing `flex-1`/`justify-center`, letting the card size to its natural content height. This means Overview's total content may now be shorter than the full tab height on some screens, leaving trailing whitespace at the *bottom* of the tab instead — a far more normal look than a mysteriously empty card in the middle. **This fix is now confirmed via direct screenshot analysis, not a blind guess** — the earlier version of this handoff had this as the top suspect without proof; that suspicion held up.

3. **"Recurring templates needs an edit button"** — built this session:
   inline edit (name, amount, cadence) via a pencil icon, matching the
   category-rename UI pattern. Compiles clean. Not visually confirmed.

4. **"Monthly pot — scroll is off-color"** — interpreted as the native
   number-input spinner arrows (browser-default UI that doesn't respect any
   theme CSS variable). Hidden app-wide via a new global CSS rule
   (`input[type="number"]::-webkit-outer/inner-spin-button`). **This is a
   best-guess interpretation of an ambiguous bug description** — if this
   wasn't what "off-color scroll" meant, get a screenshot before guessing
   again.

5. **"Day logging streak not in line with 'spent this week'/'indulgence'
   hierarchy"** — checked the code directly: all three KPI cards already use
   the identical `DeltaStat` component (`deltaPct` is optional, streak card
   correctly omits it). This looks like it should already be visually
   correct. **Likely the same "reported before the fix went live" pattern
   that's happened several times this session (Daily Prompt removal and the
   toggle-switch fix both had this exact issue) — re-verify against the
   LATEST zip before assuming there's still a bug here.**

## Testing notes worth knowing (patterns that mattered)

- **Every non-trivial function in this codebase has been unit-tested in
  isolation** via `npx tsx` scratch scripts before shipping — this caught
  real bugs repeatedly: a Monday-week calculation, a sparkline that needed to
  correctly cross month boundaries, a category-reorder edge case, and (this
  session) two separate bugs in subscription-email merchant extraction. This
  practice should continue.
- **Sed with cascading find-replace is dangerous**: an early session mistake
  used `sed` for a global `+2px` text-size bump in two sequential passes,
  which caused a `14px → 16px → 18px` double-application bug on some values
  (each pass matched the OUTPUT of the previous one). The fix was to always
  do multi-value replacements in a **single pass** with a lookup dictionary
  (Python, not sequential sed calls). This exact technique was reused
  successfully this session for the text-scale class migration across 6
  files — verified zero corruption artifacts afterward.
- **A schema.sql edit accidentally deleted the `-- Row Level Security`
  section comment TWICE this session** via a careless `str_replace` that
  matched more than intended. Both times were caught by grepping for the
  comment text right after editing. Worth double-checking after any
  schema.sql edit.
- **The FAB positioning bug** (tray collapsing to a narrow sliver, only
  showing the first grid column) took two attempts. First attempt used
  `position: absolute` inside a flex item sized as a percentage of that flex
  item — a genuinely fragile CSS pattern (flex items have real edge cases
  around percentage-sized absolutely-positioned children). Reverted to
  `position: fixed` (viewport-relative, far more predictable) with a smaller
  width cap (440px) as the actual fix for the original "FAB covers the
  ledger" complaint, instead of the more complex relative-positioning
  approach. **If any future FAB/overlay positioning bug comes up, be
  suspicious of `position: absolute` inside flex containers as a class of
  bug, not just this specific instance.**

## Environment / deployment

Vercel env vars needed: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
(separate Google Cloud OAuth credentials from whatever Supabase's own Google
provider uses — needed specifically for the `gmail.readonly` scope). Gmail
OAuth redirect URI `https://expensior-web.vercel.app/auth/gmail-callback`
must be in Google Cloud Console's authorized redirect URIs.

Local build check (what's been used all session to verify before shipping):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder \
GOOGLE_CLIENT_ID=placeholder \
GOOGLE_CLIENT_SECRET=placeholder \
npm run build
```

## How to proceed in the new chat

1. **Read this file first.** Then skim `lib/types.ts` and `supabase/schema.sql`
   for the current data model.
2. **Ask the user for fresh screenshots** of the 5 open issues above before
   making further changes — several of the "fixes" in this handoff are
   best-guess/unconfirmed, and guessing further without visual feedback risks
   repeating the FAB-positioning mistake (two failed attempts before the root
   cause was actually understood).
3. **Confirm the migration has been run** — ask whether
   `global_merchant_patterns` exists in their Supabase Table Editor and
   whether `settings.text_size` exists, since this exact class of error
   ("column X does not exist") has happened multiple times this build.
4. Once desktop issues are confirmed solid, the two largest remaining pieces
   are: mobile responsive layout, and the Chrome extension right-click/page-
   capture work (a separate codebase — don't try to build it inside this
   Next.js repo).
