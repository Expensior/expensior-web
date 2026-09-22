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
- **Sticky day-header horizontal gap — CONFIRMED FIXED (redeployed and
  verified working).** The `-mx-[18px] px-5` fix described above was
  correct on the first precise attempt; the report that it "still wasn't
  fixed" turned out to be a stale deployment, not a wrong number. **Pattern
  worth noting**: this was at least the second time this session a fix was
  reported as not working when the actual issue was testing a stale build
  (the `settings.text_size` column error was the other clear case). Before
  assuming a fix is wrong and iterating further, confirm the latest zip was
  actually redeployed and hard-refresh the browser first — it's cheaper than
  another round of guessing.
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
- Mobile responsive layout — **this entry is now stale as written below, left
  for history**: portrait mobile WAS built in a later session turn than when
  this note was first written (Ledger as a slide-in drawer, bottom tab bar,
  responsive FAB positioning — see the "Built, structurally sound" section
  above for the actual current status, which is "built, never seen on a real
  device or resized browser"). Landscape orientation specifically was never
  addressed and remains genuinely unbuilt.
- Right-click context menu / page-capture (browser extension) — **deliberately
  put on hold, not just unstarted**. This is a genuinely different codebase
  (Manifest V3 extension: manifest.json, background service worker, content
  script), and a real architecture discussion happened before deciding to
  hold off — worth preserving the reasoning rather than just the outcome:
  - The feature was originally scoped as two distinct mechanisms: right-click
    on selected text (small permission footprint — `activeTab` is enough),
    and a floating "capture from this page" auto-detect prompt (needs much
    broader host permissions running across most sites the person visits).
  - Decided against building either for now because: (1) even though the
    developer is the primary user, the app may be tried by less technical
    people, and asking them to grant broad cross-site permissions for a
    feature this niche is a bad trust ask relative to the app's current
    scale; (2) **mobile browsers don't support extension APIs at all** —
    Chrome for Android has no equivalent to context menus or content
    scripts, and there's no "right-click and select text" gesture on touch
    devices anyway. This was never going to be a build-once feature; it
    would always be desktop-only, which is a platform inconsistency not
    worth taking on yet.
  - **If this gets revisited later**: the original design intent (found by
    searching the early ideation transcript, not re-derived) had the
    right-click/capture features explicitly NEVER appearing as a tile in the
    FAB hub — they're a genuinely different surface, discovered by browsing,
    not advertised inside the app's own UI. Duplicate-detection between the
    two mechanisms (and against manual entry) was planned via a fingerprint
    check (merchant + amount + same day), the same concept already used for
    bulk import deduplication, rather than trying to suppress one trigger in
    favor of the other.

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

- **AI insights (this session, on-demand)**: a "Generate" button in Overview,
  below the existing graphics. Tapping it aggregates the person's FULL
  transaction history (never sent raw to Claude — see
  `lib/insightsSummary.ts`) into day×category totals, regret counts by day,
  indulgence rate by category, month-over-month deltas, and frequent
  merchants, then asks Claude to find 2-3 specific cross-metric patterns.
  Results are cached in a new `insights` table (one row per user, overwritten
  each generation — this is on-demand, not scheduled, so no history is kept).
  **The aggregation logic was unit-tested against synthetic data with
  hand-calculated expected values** (day totals, regret counts, indulgence
  rates, MoM deltas, windfall-exclusion) before ever being wired to the API
  — all passed. **The prompt is the highest-risk part of this feature and
  deserves scrutiny if anyone edits it**: this app's whole "awareness
  without guilt" philosophy has been protected everywhere else through
  hand-written, carefully-worded strings (digest insights, Overview's
  category sentence, etc.) — this is the first surface where an LLM
  generates the user-facing insight text itself, which means it's not
  automatically bound by that care unless the prompt enforces it explicitly.
  The current prompt bans specific words ("overspending", "wasting", "bad",
  "guilty") and requires suggestions to be phrased as soft possibilities, but
  wording like this is inherently a "test and see what it actually
  generates" situation, not something provably correct from reading the
  prompt alone — this needs real usage against a real API key to know if the
  tone lands right, more than any other feature in this document.
  **Migration note**: same "queried separately, doesn't throw" pattern used
  here as elsewhere — a missing `insights` table (unmigrated) degrades
  gracefully to "no cached insights yet" rather than breaking the whole
  app's data load, learned from repeated migration-lag issues earlier this
  session.

- **Voice input disabled (this session)**: proved unreliable on both desktop
  and mobile. Commented out (not deleted) in `EntryFab.tsx` — the tile in
  the hub grid and the `VoiceView` render call are both commented with a
  note pointing to each other. `VoiceView` itself is untouched and still
  fully defined, just unreachable. Also removed from `FeatureGuide.tsx`'s
  slides. If browser speech APIs improve enough to reconsider, the code is
  still there to uncomment rather than needing to be rebuilt.

- **Model string bug (caught and fixed this session)**: all three Claude API
  routes (`scan-receipt`, `categorize-merchant`, `generate-insights`) were
  using `claude-sonnet-4-6` — which is the model string specific to
  Artifacts' in-browser demo `fetch()` calls, not a valid string for real
  production API usage. This would have made every AI feature fail (or hit
  the wrong model) the moment someone actually tried them with a real API
  key. Fixed to `claude-sonnet-5`, the current correct model string,
  confirmed via web search against Anthropic's own pricing page rather than
  from memory. **Worth double-checking model strings specifically** any time
  new AI features get added to this codebase — this mistake was silent
  (compiled fine, only breaks at actual runtime against a real key).

- **"Something went wrong generating insights" error (reported live, fixed)**:
  this exact string is the server-side catch-all in
  `app/api/generate-insights/route.ts`, meaning the request reached the
  server but something threw inside the try block. Most likely cause: the
  original code did `JSON.parse()` on the ENTIRE cleaned response text,
  trusting Claude returned pure JSON with nothing else — but `max_tokens` was
  only 700, and if Claude's response got cut off mid-array (very plausible
  for 2-3 cards with explanatory bodies) or included any stray preamble
  despite instructions, that naive parse would throw and fall through to
  this exact generic message. **Fixed with three changes**: (1) `max_tokens`
  raised to 1024 for safety margin, (2) JSON extraction now uses a regex to
  pull the `[...]` substring out of the response rather than assuming the
  whole string is valid JSON — tested against pure JSON, markdown-fenced
  JSON, leading preamble text, trailing commentary, and truncated/cut-off
  arrays, all handled correctly except truncation (which now correctly
  fails with a clear, specific error rather than the vague generic one), (3)
  malformed individual cards are filtered out rather than failing the whole
  batch over one bad entry. **I could not access server logs to confirm this
  was definitively the cause** — this is the single most likely explanation
  given the exact error message and the code path, not a certainty. If the
  same generic error recurs after this fix, the next step is checking
  Vercel's function logs directly for the new, more specific
  `console.error` output this fix adds (it now logs the raw response text on
  any parse failure).

- **Insights confirmed working live, with one real bug caught and fixed**:
  the feature was tested end-to-end for the first time and the generated
  insights were genuinely good — specific, cross-metric, and the tone landed
  exactly as intended (e.g. "It might be worth noticing what's different
  about Thursdays for you" — soft-possibility phrasing, not prescriptive, no
  banned words). This was the single most speculative part of this whole
  session (a prompt's tone can't be verified just by reading it), and it
  worked. **One real bug found by reading the actual output closely**: it
  used `$` instead of `₹` for currency (e.g. "$2,109") — the prompt never
  explicitly specified which currency the numbers represent, so Claude
  defaulted to the more common training-data convention. Fixed by adding an
  explicit instruction to the prompt. This is exactly the kind of small,
  easy-to-miss issue that only shows up from actually reading generated
  output, not from reviewing the prompt in isolation — worth scanning any
  future AI-generated text in this app for the same class of mistake
  (unstated assumptions Claude fills in with a generic default).

- **Two-factor authentication (this session)**: uses Supabase Auth's built-in
  TOTP MFA (free, enabled by default on all Supabase projects — verified via
  web search against current docs, not from memory, since this is
  security-critical code). Three new pieces:
  - `components/MfaSettings.tsx` — Settings > Security section. Enroll shows
    a QR code plus the raw secret as a manual-entry fallback (per Supabase's
    own recommendation for people who can't scan), verifies with a 6-digit
    code, and can unenroll with a confirmation step. Also cleans up the
    unverified factor if enrollment is cancelled mid-flow, rather than
    leaving an orphaned factor behind.
  - `components/MfaChallenge.tsx` — a full-screen gate shown instead of the
    app when needed.
  - **The critical piece**: `App.tsx`'s `load()` function now calls
    `getAuthenticatorAssuranceLevel()` right after confirming a session,
    before loading any data. If `currentLevel !== nextLevel`, the person has
    a verified factor but hasn't passed the challenge yet this session — the
    app renders `MfaChallenge` instead of proceeding. **This check is the
    whole point** — per Supabase's own docs, enrolling a factor by itself
    enforces nothing; an application has to actually check the AAL and gate
    on it, or the enrollment UI is decorative. This gate runs regardless of
    which method signed the person in (magic link or Google), since it lives
    in `App.tsx`'s shared load path rather than in either auth callback
    route individually.
  - **Confidence level**: TypeScript compiled clean against the actual
    `@supabase/supabase-js` types for every method and response shape used
    (`enroll`, `challenge`, `challengeAndVerify`, `unenroll`, `listFactors`,
    `getAuthenticatorAssuranceLevel`, and their return shapes) — if any
    property name were wrong, this would have failed to compile. That's
    real signal, but **this has not been tested against an actual
    authenticator app or a live Supabase project** — the full enroll →
    scan → verify → sign-out → sign-in-again → challenge loop needs a real
    end-to-end test before trusting it in practice. No new migration is
    needed for this feature — it uses Supabase's built-in auth schema, not
    a custom table.

- **Feature guide tier differentiation and 2FA slide (this session)**: two
  problems fixed. First, all tier slides looked visually identical — fixed
  with a progressive tint of the theme's own accent color (light → medium →
  full strength) computed via `color-mix()` on existing CSS variables, plus
  a numbered badge (1/2/3) as the primary, unambiguous differentiator (shade
  alone can be too subtle to register at a glance). **Deliberately theme-
  inheriting, not hardcoded monochrome** — this was a direct choice over an
  earlier monochrome proposal, since reusing `var(--accent)`/`var(--surface)`
  means it automatically looks correct across all 11 themes without
  hardcoding a new palette or needing to verify each theme individually.
  Text color flips to `var(--bg)` once a tier's background gets dark enough
  (tiers 2 and 3), reusing the exact accent-button text pairing already used
  throughout the rest of the app, rather than introducing a new pairing to
  verify. Second, 2FA setup had no slide explaining it — added as a 4th
  section, "Account and security," which is NOT a tier (works identically
  regardless of what's unlocked) and is styled to visually say so: plain
  surface background, dashed border, a lock badge instead of a numbered one.
  Navigation logic (already generic across variable-length tiers) was
  re-verified with the new 5/2/2/1 slide-count structure — all 10 slides
  visited exactly once in the correct order, both directions.

- **Feature guide legibility bug (found via screenshots, fixed)**: the
  card-wide accent-tint approach from the previous fix was confirmed broken
  via three screenshots across three different themes (Spring awakening,
  Coastal breeze, Monsoon and earth) — the tier name and tagline text were
  washed out and barely readable in every single one. Root cause:
  `var(--text)`/`var(--muted)` are proven to contrast well against the app's
  normal `var(--bg)`/`var(--surface)` backgrounds (used everywhere else in
  the app), but were never actually validated against a *computed*
  accent-tint background — that pairing was an unverified assumption, and it
  failed. **Fixed by reverting the card itself to the plain, proven
  `var(--bg)`** and moving all tier differentiation into two small,
  non-text-bearing elements instead: the numbered badge (outline → thicker
  outline → filled, as strength increases) and the icon circle. While fixing
  this, caught and fixed a second instance of the *exact same class of bug*
  before it shipped: the icon circle's full-strength tier used
  `var(--accent)` for both the background AND the icon color, which would
  have made the icon invisible against its own background — same mistake,
  caught this time by re-reading the code rather than needing a fourth
  screenshot. **Lesson for this specific pattern going forward**: any time a
  background color is *computed* (via `color-mix` or similar) rather than
  being one of the small set of base theme variables, do not assume an
  existing text/icon color pairing carries over — it needs to be reasoned
  through explicitly for that specific computed value, since the existing
  pairing was only ever validated against the base variables it was
  designed for.

- **Handwritten font: scoping override for the Ledger's three highlight
  boxes (this session)**: originally scoped the handwritten font to
  "genuine user input" specifically, deliberately excluding the "Most
  frequent" box's category name and "Busiest day" box's date as structural/
  computed labels rather than something the user typed. User caught the
  actual visual result of that distinction: sitting side by side in the
  same row, having "Biggest expense" in handwriting while the other two
  stayed in the system font read as inconsistent, not intentional. Overrode
  the original scoping for this specific cluster — all three box values
  (`highlights.topCategory.name` and the busiest-day date, alongside the
  already-handwritten expense description) now get `.handwritten-text`.
  The broader distinction (amounts and category names elsewhere in the app
  stay in the system font) is unchanged; this override applies only to
  these three boxes specifically, where the three sit together as one
  visual unit and needed to read as one.
  **Follow-up correction, same session**: the first pass put the
  handwritten treatment on the "Biggest expense" box's merchant
  *description* ("House Rent"), leaving the *amount* (₹53,000) in the
  system font. That was the wrong line — in the other two boxes, the
  large bold value that gets the handwritten treatment is the category
  name / date, i.e. the box's headline figure, not its smaller caption.
  Swapped: the amount now gets `.handwritten-text`, the description reverts
  to the system font, matching the same "headline value is handwritten,
  caption stays plain" pattern the other two boxes already have. **Worth
  being explicit about**: this puts an amount in the handwritten font,
  which contradicts the ORIGINAL general rule (amounts stay in the system
  font everywhere, since handwritten digits are harder to scan quickly).
  That general rule is unchanged everywhere else in the app — this is a
  second deliberate, scoped exception for this one specific cluster of
  three boxes, not a reversal of the broader principle.

- **Flagged subscriptions: dedup + remove, both genuinely missing until now
  (this session)**: user-reported bug — flagged Netflix twice (once via the
  manual form in Settings, which has no dedup check at all) and had no way
  to remove either entry, since no delete/remove action existed anywhere in
  the UI. Two real fixes:
  1. **Dedup on add**: `addFlaggedSubscription` now checks (case-insensitive,
     whitespace-trimmed) against already-flagged merchants before inserting,
     returning `'added' | 'duplicate'` so callers can give real feedback
     rather than silently doing nothing or silently duplicating. The
     Settings form now shows "already flagged — see it in the Subscriptions
     tab" instead of just clearing the input either way.
  2. **A genuinely interesting find**: the `flagged_subscriptions` table
     already had a `cancelled` boolean column, and the load query already
     filtered on `.eq('cancelled', false)` — the soft-delete mechanism was
     designed into the schema from early on, but no UI action anywhere ever
     actually set it to `true`. `removeFlaggedSubscription` now does exactly
     that (update, not delete — preserves history), with a lightweight
     inline confirm per row in the Dashboard's Subscriptions tab, matching
     the same confirm pattern already used for disabling 2FA.
  Dedup logic tested directly (case variations, leading/trailing whitespace,
  a genuinely-new merchant correctly passing through) before considering
  this done. Container had reset between sessions for this fix — recovered
  the project from the last delivered zip in outputs rather than
  reconstructing from memory, confirming the zip is a reliable fallback if
  this happens again.

- **Three small follow-ups (this session)**:
  1. **Handwritten font: proper on/off toggle.** The original 4-button
     picker (Off/Caveat/Architects Daughter/Patrick Hand) conflated "on/off"
     with "which font" — switching off and back on meant re-picking your
     font each time. Restructured into a `ToggleRow` (same component used
     for Friday digest/Sunday wrap) plus a 3-option picker shown only while
     on; a local `lastHandwrittenFont` state remembers your last choice
     across toggling off and back on, without needing a schema change (the
     `handwritten_font` column still just stores `'none'` when off). Two
     real syntax errors (an orphaned leftover JSX fragment, then a stray
     unmatched `</div>`) got introduced and caught during this restructure
     — both from editing an existing multi-line block piecemeal rather than
     replacing it as one clean unit; worth being extra careful with exact
     old_str boundaries when restructuring JSX that spans several closing
     tags, not just appending new content.
  2. **"Last updated" date at the bottom of Settings.** Deliberately NOT
     computed at runtime in the browser (`new Date()` in client code would
     show whenever a visitor happens to load the page, not when the app was
     actually deployed). Instead, `scripts/generate-build-date.js` runs via
     npm's `prebuild` lifecycle hook (fires automatically before `next
     build`, verified by running a plain `npm run build` and confirming the
     hook fired without any special configuration) and writes today's date
     into a generated `lib/buildDate.generated.ts`, imported and displayed
     in Settings. This means the date only changes on an actual rebuild —
     exactly the "when was this last deployed" signal intended, not a
     "what day is it" clock.
  3. **Feature guide reviewed against everything built recently — two real
     gaps found, not zero.** AI insights (Overview tab's "Generate" button)
     had zero representation anywhere in the guide — added as a new slide
     in "Master of my domain." Separately, the existing "Receipt scan"
     slide's wording ("Snap or upload *a photo*") was stale, not just
     incomplete, since Scan now supports selecting multiple images at once
     — updated the wording rather than just adding something new next to
     stale text. Navigation re-verified with the tier now at 5/2/3/1 slides
     (Tier 3 grew from 2 to 3) — all 11 slides visited exactly once, correct
     order. Everything else considered (autocomplete, handwritten fonts,
     mobile layout, the Gmail scan and WCAG fixes) were deliberately left
     alone — either minor enough to fold into existing slide wording,
     personalization the guide doesn't cover for anything else either, or
     bug fixes that don't change what a slide claims a feature does.

- **Handwritten font for user-entered content (this session)**: a new
  Settings control (Caveat / Architects Daughter / Patrick Hand / Off) that
  applies a handwriting-style font specifically to genuine user input —
  transaction descriptions and reflection answers — deliberately NOT applied
  to amounts, category names, or any computed/structural text. The three
  fonts were chosen after comparing roughly a dozen candidates directly
  against real transaction-row content, specifically screening out ones
  that looked nice but would hurt quick scanning (connected-cursive fonts
  like Dancing Script or Homemade Apple, thin-stroke ones like Shadows Into
  Light or Reenie Beanie that struggle at small sizes).
  **Font sizing is per-font, not uniform**: Caveat needed roughly 1.42x the
  base size to read as comfortably as the other two — verified by direct
  side-by-side comparison before building anything, not guessed. Sizes are
  applied in `em` (`app/globals.css`, scoped by a `data-handwritten`
  attribute + a `.handwritten-text` class), so they compose correctly with
  the existing Compact/Default/Large text-size setting rather than
  conflicting with it.
  **A real build-environment limitation, worked around properly, not
  papered over**: `next/font/google` (the standard way to load Google Fonts
  in Next.js) fetches the actual font files from Google's servers at BUILD
  time — and this sandbox's network access doesn't include
  `fonts.googleapis.com`, only a specific package-registry allowlist. This
  is a genuine gap in what could be verified here, unlike everything else
  this session. **Resolved, not just disclosed**: GitHub is in the allowed
  domains, and Google Fonts' actual font files are mirrored on GitHub's
  official `google/fonts` repository under the same OFL license — fetched
  the three real font files from there (verified as genuine TrueType font
  data, not placeholder files) and switched to `next/font/local`,
  self-hosting them from `app/fonts/`. This fully removed the network
  dependency at build time entirely, verified with a completely clean build
  — arguably a more resilient outcome than the original plan, since it
  doesn't depend on Google's CDN being reachable during any future build,
  on Vercel or anywhere else.
  **Where it's applied**: Ledger transaction rows and the "Biggest expense"
  highlight box's description (NOT the "Most frequent" box's category name,
  which is a structural label, not user input), every description
  input/display across `EntryFab.tsx` (Quick-add, Detailed mode, Scan
  preview cards, SMS/Gmail candidate lists), the edit-transaction modal, the
  merchant-autocomplete dropdown suggestions, and the three Reflect
  textareas plus the reflection history feed's actual written content
  (explicitly not its dates or "Good:"/"Regret:"/"Wish:" labels).
  **Migration needed**: `handwritten_font` column added to `settings`.

- **Ledger highlight boxes: hardcoded white text, genuinely broken in most
  themes (this session)**: found via three new screenshots showing the
  "Biggest expense" and "Most frequent" boxes rendering completely blank in
  some themes, barely-legible in others. Root cause, confirmed by reading
  the code: the three highlight boxes (`Biggest expense` on `var(--accent)`,
  `Most frequent` on whichever `--cat-N` the top category maps to,
  `Busiest day` on `var(--border)`) all used hardcoded
  `rgba(255,255,255,...)` text. This is a DIFFERENT, previously-unaudited
  claim from the earlier WCAG pass — that pass tuned `--accent` to contrast
  against `--bg` (whatever color that is per theme), never against literal
  white. In dark-background themes specifically, `--accent` is naturally
  chosen to be light/bright to pop against a dark `--bg` — and white text on
  a light accent color is exactly the near-invisible result in the
  screenshots.
  **Computed properly rather than guessed**: checked literal white against
  all 7 relevant backgrounds (accent, border, cat-1 through cat-5) across
  all 11 themes — 77 checks, 46 failures. Root cause: hardcoded white can
  never reliably work against a background that varies by both theme and
  category.
  **Fix**: added explicit `--on-accent`, `--on-border`, `--on-cat-1` through
  `--on-cat-5` CSS variables to every theme (each set to whichever of white
  or a near-black `#1A1A1A` actually clears 4.5:1 for that specific
  background), plus a parallel `ON_CAT_COLORS` mapping in `categories.ts`.
  Four combinations had NEITHER white nor dark clear the bar (background too
  medium-lightness for either extreme) — resolved by nudging the underlying
  background derivation itself (autumn-harvest's `--border` darkened 3%;
  cosmic-aurora's and smoked-obsidian's `--cat-4`, and cosmic-aurora's
  `--cat-3`, given theme-specific formula overrides rather than changing the
  shared global formula, which would have risked breaking other themes that
  currently pass at the default percentage). Reverified all 77 combinations
  pass after these adjustments.
  **A second bug caught before shipping, not after**: the first version kept
  the title/caption text at reduced opacity for visual hierarchy (title
  faint, value bold, caption faint — mirroring the original design). Testing
  the tightest-margin on-color choices at that reduced opacity showed the
  fade alone was enough to drop contrast back under 4.5:1 on several
  borderline cases (e.g., 4.56 full-strength dropping to 3.28 at 25%
  transparent) — meaning correct math at full strength doesn't survive
  being faded. Fixed by giving title/caption/value all identical full-
  strength on-color; visual hierarchy now comes from size/weight only
  (already present), not opacity. The decorative icon keeps its faded
  opacity and was deliberately left alone — WCAG 1.4.11's non-text contrast
  standard explicitly exempts purely decorative graphics that don't convey
  information beyond what's already in the text, which applies here since
  the icon is just a background flourish duplicating the box's own label.

- **Gmail scan: missing recent emails and repeated duplicates, both fixed
  (this session)**: two real, user-reported bugs, both traced to the actual
  code rather than guessed at.
  **Missing recent emails**: the search used a multi-OR-clause query
  (`receipt OR invoice OR "order confirmed" OR ...`) capped at
  `maxResults=15` with no explicit sort. Gmail's search ranking for queries
  with a `q` parameter blends relevance with recency, not pure chronological
  order — a genuinely recent email with a weaker keyword match can rank
  below an older, stronger match, and a small result cap makes it easy for
  that to push recent emails out entirely before they're ever fetched. Fixed
  by raising the pool to `maxResults=40` and explicitly sorting the fetched
  results by actual `internalDate` (already being extracted per-message,
  just never used for ordering) rather than trusting Gmail's returned order.
  **Repeated duplicates**: there was no deduplication at all. The search
  window (`newer_than:30d`) is rolling — an email from 10 days ago still
  matches on every scan for the next 20 days, and with nothing comparing
  against existing transactions, the same email resurfaced as "new" every
  time. Fixed by querying the user's own transactions in the same date
  window and filtering out any candidate matching an existing transaction
  by amount + date + merchant-name overlap.
  **A real bug caught by testing the dedup logic before shipping it**: the
  first version matched merchant names via an exact-match hash key
  (normalized text, truncated to 20 characters). Test case "HungerBox" vs.
  "HungerBox - Office Cafeteria" — obviously the same real merchant —
  failed to match, because exact-match on a truncated string doesn't do
  substring matching; it only works when both strings happen to be
  byte-identical in their first 20 characters, which doesn't hold when the
  same merchant appears with different-length descriptions across sources
  (a very normal, expected situation, not an edge case). Fixed by switching
  to bidirectional substring matching (`a.includes(b) || b.includes(a)` on
  normalized text) grouped by exact amount+date first for efficiency.
  Reverified with the corrected logic, including a harder case (two
  existing transactions sharing the same amount+date, only one actually
  matching) to confirm the fix doesn't just work on the simple case.

- **Merchant autocomplete (this session)**: as you type a merchant name,
  suggestions now appear from your own transaction history — no new data
  source needed, `allTransactions` was already loaded in `App.tsx`.
  `knownMerchants` is a frequency-ranked, deduplicated (case-insensitive,
  whitespace-trimmed) list computed once via `useMemo`, threaded into three
  places: the Quick-add preview and Detailed-mode description fields in
  `EntryFab.tsx`, and the edit-transaction modal in `EntryZone.tsx`. Built
  as one reusable component (`MerchantAutocomplete.tsx`) rather than three
  separate implementations. Matching logic: prefix matches first (typing
  "sw" suggests "Swiggy"), falls back to substring matches so something
  like "food" can still surface "Avatar Food Court", excludes suggesting
  the exact thing already typed, capped at 5 results — all verified with
  targeted test cases before wiring in, including the frequency-ranking
  itself (mixed-case duplicates of the same merchant correctly collapse to
  one entry, counted together). One real UI detail worth knowing if this
  gets touched again: the dropdown uses `onMouseDown` with
  `preventDefault()` rather than `onClick` for selecting a suggestion —
  `onMouseDown` fires before the input's `onBlur`, so a click registers
  before the dropdown would otherwise close out from under it; using
  `onClick` here would have made selection unreliable. Compiles clean, not
  yet tested against real typing in a live browser.

- **Desktop text baseline lowered to match mobile's Compact (this
  session)**: direct user feedback — mobile's Compact (A-) is the right
  size, but that same absolute size felt too small when it was mobile's own
  *default*, and desktop's default was rendering even larger than that.
  `--text-offset` was previously a single global value regardless of screen
  size (compact=-1px, default=0px, large=+3px, identical on mobile and
  desktop). Added a `@media (min-width: 768px)` override — the same
  breakpoint already used everywhere else in the app for the mobile/desktop
  split — shifting the whole desktop scale down 1px uniformly: desktop
  compact=-2px, default=-1px, large=+2px. This makes desktop's default
  exactly equal to mobile's compact (verified: both resolve to offset -1,
  not just visually similar), while leaving mobile completely untouched and
  preserving the existing 1px/3px relative spacing between compact/default/
  large on both screen sizes — only which absolute size counts as
  "default" per device changed, not the relationship between the three
  levels. The existing `max(8px, ...)` floor in every `.text-sc-N` rule
  continues to protect against anything shrinking below 8px at the new,
  more negative desktop offsets.

- **Horizontal scroll removed entirely — confirmed on desktop too, not just
  mobile (this session)**: the user's own diagnosis was exactly right and
  matches what was found (but paused on, at their request) a few turns
  earlier — the Ledger's transaction-list container used `overflow-auto`,
  which enables scrolling on *both* axes. The `-mx-[18px]` bleed applied to
  the sticky headers and rows (from the earlier background-coverage fix) is
  deliberately wider than the container — that's the point, so the
  background reaches the panel's true edge — but `overflow-auto` can't tell
  "intentional cosmetic bleed" apart from "content the user needs to scroll
  to see." It just saw width exceeding the container and offered a
  scrollbar for it, even though nothing was actually cut off. Fixed by
  splitting it into `overflow-y-auto overflow-x-hidden` — vertical scrolling
  behaves identically, the bleed still visually reaches the edge, it just
  can't be swiped/scrolled into as empty space anymore.
  **Applied the same fix more broadly, not just to the one spot that
  surfaced it**: grepped for every other `overflow-auto` in the codebase
  (5 more — Dashboard's main content pane, three candidate-review lists in
  `EntryFab.tsx`, and the transaction edit modal in `EntryZone.tsx`). None
  of them use the specific bleed technique that caused the Ledger's
  problem, but per the same general principle — there's no reason to leave
  horizontal scroll *possible* anywhere it isn't actually needed — converted
  all of them to the same `overflow-y-auto overflow-x-hidden` pattern as a
  defensive pass, not because each was individually confirmed broken.

- **Scan: multi-select and date visibility (this session)**: two real gaps
  fixed. The file input only ever processed `e.target.files?.[0]` — the
  first file, even if multiple were selected, especially painful on mobile
  where the native picker naturally offers multi-select. Rewired to
  `multiple` on the input, processing every selected file in parallel via
  `Promise.all`, with per-file failures skipped individually rather than
  failing the whole batch (shows "Read 3 of 4 images — 1 couldn't be
  parsed" rather than an all-or-nothing error). Second: the review card
  captured `date` from the scan result but never displayed or let you edit
  it — amount, description, and category were all visible, date silently
  wasn't, so a misread date from OCR had no way to be caught before adding.
  Added an actual `<input type="date">` per result. Rebuilt the whole
  preview flow around the same `{amount, description, category,
  indulgence, date, selected}`-shaped list already used by `SmsView` and
  `GmailView` (via `onBulkAdd`) rather than the old single-`onAdd` shape,
  so multiple scanned receipts now show as a stack of independently
  editable cards (each with its own remove button) with one "Add N
  transactions" button at the bottom, plus a "+ More" to keep scanning
  without losing what's already been read. Compiled clean, including
  TypeScript validating the reshaped props against `EntryFab`'s existing
  bulk-add plumbing — not yet tested against a real multi-image selection
  on an actual phone.

- **Full WCAG contrast audit — COMPLETE, all 187 checks passing (this
  session)**: after the
  Feature Guide legibility bug, did a genuinely rigorous audit rather than
  spot-checking further instances by eye. Grepped every `text-[var(--X)]`
  and inline `color: var(--X)` usage across the whole codebase (334 raw
  occurrences), verified the actual container nesting for each (not
  assumed — e.g. confirmed every `bg-[var(--bg)]/NN` opacity variant is
  nested inside a `bg-[var(--surface)]` parent, requiring proper alpha-blend
  math, not a flat comparison), and computed real WCAG 2.1 contrast ratios
  (formula validated against known reference values — black/white = 21.0,
  the classic `#767676`-on-white ≈ 4.5 case — before trusting it on real
  theme data) for 17 distinct real pairings across all 11 themes.
  **Result: 106 of 187 checks failed.** Three headline findings: `text` was
  perfect everywhere (11/11 on every background, zero changes needed);
  `danger` on `surface` failed in literally all 11 themes (not
  theme-specific — a systemic miss); primary buttons (`bg`-on-`accent`)
  failed in 6 of 11 themes.
  **Impact analysis, not a guess**: tallied failures attributable to each
  variable as the foreground — `muted` accounted for 44 of 106 (more than
  accent+danger+positive+button-text combined). Checked feasibility before
  proposing a fix: for every one of the 11 themes, either pure black or
  pure white already cleared 4.5:1 against both `bg` and `surface`
  simultaneously, proving a fix was achievable, not just hoped-for.
  **Fix applied**: binary-searched the minimum shift (toward black or white,
  whichever direction was feasible per theme) that clears 4.5:1 against
  both backgrounds, for all 11 themes' `--muted` value. First pass left 3
  themes failing by a hair (dusty-rose 4.49, cosmic-aurora 4.48, watermelon-
  sorbet 4.50) — traced to hex-rounding tipping a razor-thin 4.50 target
  back under the line after discretizing to the nearest achievable 8-bit
  color. Recomputed those three with a 4.55 buffer specifically to absorb
  that rounding error, then reverified against the actual rounded hex
  values (not the pre-rounding float) this time. Final state: all 55
  muted-related checks (11 themes × 5 backgrounds it actually appears
  against) pass, worst case 4.504:1.
  **Then applied the same process to `danger`, `positive`, and `accent`,
  and found one genuine mathematical infeasibility along the way**: for
  autumn-harvest, `accent` needs to satisfy three simultaneous constraints
  (contrast against `bg`, against `surface`, AND against its own 15%-tint
  blend used for the active filter chip) — and neither pure black nor pure
  white could satisfy all three at once. Diagnosed precisely rather than
  guessing around it: even pure white only reached 4.10 against its own
  blend, short of 4.5, because the blend is 85% surface and surface itself
  is fixed — no amount of adjusting accent alone could fix a formula where
  85% of the comparison background doesn't move. Fix: reduced the active
  filter chip's blend from 15% accent to 10% (`Ledger.tsx`), which
  mathematically can only make this specific constraint *easier* everywhere
  (a lower blend percentage pulls the background closer to the pure-surface
  case, which was already passing in all 11 themes) — confirmed this
  before applying it, not assumed. One large, real visual consequence
  worth knowing about: autumn-harvest's `--accent` had to shift essentially
  all the way to white (`#C15C3D` → `#FFFFFF`) to satisfy all three
  constraints — not a subtle tweak, a dramatic color change for that one
  theme specifically, and the computed, unavoidable cost of the fix rather
  than an artifact of the method.
  **A design-intent side effect worth flagging**: watermelon-sorbet's
  `globals.css` comment originally noted `--danger` and `--accent`
  deliberately shared the same value ("this palette already contains a
  genuinely red-leaning color, so it does double duty as both"). Fixing
  each variable against its own distinct set of constraints gave them
  different values (danger → `#7A2534`, accent → `#6B202E`) — breaking that
  original shared-color intent. This is a reasonable, expected side effect
  of fixing each variable rigorously and independently, not a mistake, but
  worth knowing if anyone revisits that theme's original authoring comment.
  **Final result, fully reverified across all 17 pairings and all 11
  themes**: 0 of 187 checks failing. Every text/background and
  button-fill pairing identified in the audit now passes WCAG AA.
  **A real, honest caveat about scope, still true**: this entire audit
  covered text and button-fill contrast (WCAG 1.4.3) only. It did NOT apply
  the separate non-text/UI-component contrast standard (WCAG 1.4.11, 3:1
  minimum) to category dots, borders, or other non-text colored elements —
  that's a distinct check with its own formula application, not yet done,
  and would need the same rigor applied fresh rather than assumed to be
  fine just because the text-contrast pass is now clean.

- **Feature guide (this session)**: recovered from the ORIGINAL Chrome
  extension's `popup.js`, which had an onboarding "feature guide" — a
  click-through slide deck organized by tier, with an `isRoadmap` flag
  distinguishing real features from "coming soon" ones. Rebuilt as
  `components/FeatureGuide.tsx`, a single reusable component used in two
  places: an "Explore" button on the login page (before sign-in), and a
  "Feature guide" link in Settings (right after Sign Out, matching the
  original's "re-accessible from Settings" behavior). Content reflects the
  CURRENT build, not the original's — worth knowing: Screenshot Scan and
  Voice were the two features the original app's own onboarding admitted
  were fake placeholders (`isRoadmap: true`). Scan is real and working in
  this build. Voice was too, briefly — it was included in this guide when
  first built, then removed later the same session once it proved
  unreliable (see the "Voice input disabled" entry above). No `isRoadmap`-style flag exists in the current
  data structure since nothing shown is currently a placeholder — if a
  genuinely aspirational feature gets added to this guide later, that
  pattern from the original is worth reviving rather than reinventing.
  Forward/backward navigation across tier boundaries was unit-tested with
  varying tier sizes (3/2/1 slides) and confirmed correct in both
  directions. The login page also got its first proper logo mark (a piggy
  bank icon in an accent-tinted circle, matching an icon visible in the very
  earliest screenshots of the old extension's UI) — previously it was
  text-only ("Expensior!" as a plain heading, no mark at all).

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
