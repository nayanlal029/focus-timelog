# Focus-TimeLog — Go-to-Market Strategy & Business Plan

**Version:** 1.0
**Date:** June 2026
**Status:** Planning

---

## Table of Contents

1. [Brand & IP Foundation](#1-brand--ip-foundation)
2. [Controlling Lovable's Scope](#2-controlling-lovables-scope)
3. [Publishing — Wear OS (Google Play)](#3-publishing--wear-os-google-play)
4. [Publishing — Android Phone App (Google Play)](#4-publishing--android-phone-app-google-play)
5. [Publishing — Web App (PWA)](#5-publishing--web-app-pwa)
6. [Publishing — iOS App Store (Future)](#6-publishing--ios-app-store-future)
7. [Pricing Model & Economics](#7-pricing-model--economics)
8. [Visual Rebrand — Methodology](#8-visual-rebrand--methodology)

---

## 1. Brand & IP Foundation

### The trademark problem with "Focus-TimeLog"

"Focus-TimeLog" is a **descriptive** name — it describes exactly what the product does. The USPTO
grades trademark strength on a spectrum:

| Strength | Example | Trademarkable? |
|----------|---------|---------------|
| Fanciful (invented) | Kodak, Häagen-Dazs | Easiest — strongest protection |
| Arbitrary (real word, unrelated meaning) | Apple (for computers), Amazon | Strong |
| Suggestive (implies, doesn't describe) | Netflix, Slack | Registrable |
| Descriptive (says what it does) | "Focus Time Log" | Very hard — USPTO likely rejects |
| Generic | "Time Tracker" | Cannot be trademarked |

A descriptive mark requires proof of "acquired distinctiveness" (5+ years of exclusive use in
commerce) before the USPTO will register it — which means years of market presence before you
have legal protection. Starting with an invented or arbitrary name is far easier.

### Recommended naming approach

Pick a **1–2 syllable invented or arbitrary name**. Criteria:
- No common English word (avoids descriptiveness rejection)
- Pronounceable and memorable
- `.com` domain available
- Not already registered in USPTO Class 42

Examples to evaluate (check USPTO TESS + domain availability before committing):
- **Floq** — short, invented, no baggage
- **Tymr** — plays on "timer," suggestive not descriptive
- **Focco** — invented, easy to say
- **Vela** — arbitrary (a constellation), evokes clarity
- **Chrono** — suggestive, but already used by many products — likely conflicts

> **Next step:** Pick 3 candidate names → check USPTO TESS (tess.uspto.gov) for conflicts → check
> Namecheap or GoDaddy for `.com` + `.app` availability → choose and register.

### Trademark registration (US)

Once you have a name:

| Step | Cost | Timeline |
|------|------|----------|
| USPTO TEAS Plus application, Class 42 (SaaS/Software) | ~$250–350 | File online |
| USPTO review | $0 | 8–12 months to first action |
| Registration certificate | $0 (included) | ~18 months total if no office actions |

- File in **Class 42** (computer software; SaaS; software as a service).
- If you sell a physical product (e.g. a branded watch band), also file Class 9.
- Consider filing Class 9 pre-emptively if you anticipate hardware.
- You can file on an **intent-to-use** basis before launch (Section 1(b)) — gives you the priority
  date before actual sales begin.

### Domain registration

Register both `.com` and `.app` as soon as the name is chosen. `.app` domains are HTTPS-only
by default (good for a web app brand). Cost: ~$12–20/yr each via Namecheap or Cloudflare Registrar.

### Copyright

Copyright in the source code and design is **automatic** on creation — no registration needed.
Registering with the US Copyright Office ($65) strengthens your position in litigation (allows
statutory damages) but is not required for protection.

---

## 2. Controlling Lovable's Scope

Lovable is a capable AI builder but needs guardrails to prevent it from touching code it
shouldn't — particularly the Wear OS app, migration files, and auth configuration.

### `.lovableignore` file (highest priority)

Create a `.lovableignore` file at the repo root. Lovable respects this file and will not read,
edit, or propose changes to any path listed.

```
# Lovable must never touch these files or directories
watch/
supabase/migrations/
.env
wrangler.jsonc
```

This is the single most effective control. Commit this file and never remove it.

### Branch strategy

Tell Lovable to always open PRs to a `lovable/feature-*` branch, never directly to `main` or
`claude/*`. Your review step before merging is the gate. Add this to your Lovable project
instructions:

> "Always create a new branch prefixed with `lovable/` for every change. Never push directly to
> main. Do not modify any file in the `watch/` directory or in `supabase/migrations/`."

### Supabase migrations — manual control

Never let Lovable apply migrations automatically via the Supabase CLI. The safest workflow:
1. Lovable generates a `.sql` file in `supabase/migrations/`.
2. You review the SQL before running `supabase db push` or applying via the Supabase dashboard.
3. Migrations are one-way — a bad migration is hard to undo in production.

### Google OAuth — remove the Lovable broker dependency

Currently Google OAuth on the web app routes through **Lovable's managed OAuth client**. This
means Lovable controls the redirect URI and you have no direct access to the client credentials.
To remove this dependency:

1. Create your own GCP project → OAuth 2.0 client ID (Web application).
2. Set the redirect URI to your Cloudflare Pages domain.
3. In Supabase Auth settings → Google provider → switch from "Lovable managed" to "Custom" →
   paste your own Client ID and Secret.
4. Deploy. Lovable is no longer in the auth path.

This is a 30-minute task and removes a significant dependency.

### Hosting — Lovable is just a build trigger

The actual hosting is **Cloudflare Pages** (via `wrangler.jsonc`), which is fully under your
control. Lovable triggers builds but does not own the hosting. If you ever stop using Lovable,
you can trigger Cloudflare builds from GitHub Actions instead — no migration needed.

---

## 3. Publishing — Wear OS (Google Play)

### Pre-requisites

- **Google Play Developer Account** — one-time $25 registration at play.google.com/console.
- Android Studio with the signed release APK/AAB built (Build → Generate Signed Bundle / APK).
- Store listing assets (see below).

### Release checklist

| Item | Spec |
|------|------|
| App icon | 512×512 PNG, no alpha |
| Feature graphic | 1024×500 PNG (shown at top of store listing) |
| Screenshots | Minimum 2; use the Wear OS emulator's screenshot tool |
| Short description | ≤80 chars |
| Full description | ≤4000 chars |
| Privacy policy URL | Required (even for personal apps); host a simple page on your domain |
| Content rating | Complete the questionnaire in Play Console |

### Release track progression

| Track | Purpose | Who sees it |
|-------|---------|-------------|
| Internal testing | Fastest review (minutes); up to 100 testers | You + your Gmail accounts |
| Closed testing | Alpha; invite specific email addresses | Friends and beta users |
| Open testing | Anyone can join from the store listing | Public opt-in |
| Production | Full rollout | All users |

**Recommended:** Start with Internal → Closed (share with 5–10 friends) → Production once stable.

### Version management

`versionCode` must be a positive integer that increments with every release.
`versionName` is the human-readable string (e.g. "1.0.0").

Update both in `watch/wear/build.gradle.kts` before each release:

```kotlin
versionCode = 2          // increment by 1 each release
versionName = "1.0.1"
```

### Review timeline

Wear OS apps typically review in **1–3 business days** for initial submissions; updates are faster
(hours to 1 day). The review is automated + human; Wear-specific guidelines focus on glanceability
and round-screen design.

---

## 4. Publishing — Android Phone App (Google Play)

Same Google Play account as the watch app.

### Option A: TWA (Trusted Web Activity) — recommended for v1

A **Trusted Web Activity** wraps your existing Cloudflare Pages web app in a native Android shell
with no visible browser UI. Users get a native-feeling app with zero new backend code.

**Work required:** ~1–2 days

1. Install `bubblewrap` CLI: `npm install -g @bubblewrap/cli`
2. Run `bubblewrap init --manifest https://your-domain.app/manifest.json`
3. `bubblewrap build` → produces a signed APK/AAB
4. Verify **Digital Asset Links** (`/.well-known/assetlinks.json`) is served correctly — this is
   what makes Chrome hand control to the TWA without showing browser UI.
5. Upload to Play Console under a new app (separate from the watch app).

**Requirements for TWA:**
- A valid PWA `manifest.json` with `display: standalone`
- HTTPS (already via Cloudflare Pages)
- Lighthouse PWA score ≥ 80 (run `lighthouse your-url --view`)

### Option B: Native Kotlin app

Weeks of work; better long-term UX; not necessary until you have a user base that demands it.

---

## 5. Publishing — Web App (PWA)

The web app is already on Cloudflare Pages. Making it installable as a PWA is the lowest-effort
distribution channel — no app store, no review.

### PWA checklist

1. **`manifest.json`** — create or update `public/manifest.json`:

```json
{
  "name": "Focus-TimeLog",
  "short_name": "FocusLog",
  "description": "Track where your time actually goes.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

2. **Link manifest in HTML** — add to `<head>`:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#3b82f6" />
```

3. **Service worker (optional for v1)** — a minimal cache-first SW adds offline support. Can use
   Workbox via Vite PWA plugin (`vite-plugin-pwa`) for zero-config setup.

4. **Icon files** — create 192×192 and 512×512 PNG icons in `/public/icons/`. The maskable
   version has padding so it renders correctly on Android's rounded icon shapes.

### Custom domain

Buy a `.app` domain (~$20/yr) — HTTPS-only by design. Point it to Cloudflare Pages in the Pages
dashboard → Custom Domains. Total setup: 15 minutes.

### Install prompt

On mobile, browsers show "Add to Home Screen" prompts automatically once the PWA criteria are met.
On desktop Chrome, the install icon appears in the address bar.

---

## 6. Publishing — iOS App Store (Future)

### Pre-requisites

| Requirement | Cost | Notes |
|-------------|------|-------|
| Apple Developer Program | **$99/year** | pay.apple.com |
| Mac with Xcode | Varies | Required for building iOS apps; cannot build on Windows/Linux |
| Xcode version ≥ 15 | Free | For latest iOS SDK |

### Option A: Capacitor (recommended for v1 iOS)

**Capacitor** (by Ionic) wraps your existing web app in a native iOS WKWebView with access to
native APIs. Same codebase — no Swift rewrite needed.

**Work required:** ~1–2 weeks

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Focus-TimeLog" com.focuslog.app
npx cap add ios
npx cap sync
npx cap open ios   # opens Xcode
```

All Supabase calls and auth flows use the same browser-based JS — no changes to the web app code.

### Option B: SwiftUI native app

Months of work; best UX; not worth it until you have significant iOS demand.

### Apple Watch (WatchKit)

A separate WatchKit target within the iOS Xcode project. Significant additional work — the Kotlin
watch app cannot be reused; you'd need to rewrite in Swift. Defer until the Android watch app is
validated by users.

### Code comments to add now

When doing any future work on auth or Supabase calls in the web app, add a short comment on
critical flows so the Capacitor path is obvious later:

```typescript
// iOS (Capacitor): supabase-js handles this natively in WKWebView — no changes needed
```

Mark any Web-API-only features (Vibration, Web Share, etc.) for iOS polyfilling:

```typescript
// iOS: navigator.vibrate is not supported in WKWebView; gate on feature detection
if (navigator.vibrate) navigator.vibrate(100);
```

---

## 7. Pricing Model & Economics

### Recommendation: Free tier + one-time Pro purchase

**Why one-time over subscription:**
- Productivity apps with a one-time price see significantly higher organic conversion
- Your marginal cost per user is near zero (Supabase free tier covers ~50K MAU)
- Subscriptions create churn anxiety for users; a one-time purchase removes it
- Easier to start; you can always add subscription tiers later

### Proposed pricing tiers

| Tier | Price | What's included |
|------|-------|-----------------|
| **Free** | $0 forever | Web app, 30-day history, basic timer, up to 5 categories |
| **Pro** | $9.99 one-time | Unlimited history, Excel export, Chrome import, Watch app, PWA install, unlimited categories |

> **Alternative subscription pricing** (if you prefer recurring revenue):
> - Free: 14-day full trial
> - Pro: $2.99/month or $19.99/year

### Implementation path (when ready to monetize)

1. **Stripe** — payments for web (Stripe Checkout, no backend needed for one-time payments via
   Stripe.js + Supabase Edge Function webhook to flip a `is_pro` flag on the user record).
2. **Google Play Billing** — for the Android/Watch app in-app purchase.
3. **Apple StoreKit** — for iOS in-app purchase.
4. **Entitlement check** — add `is_pro` boolean to `user_profiles`; gate Pro features in both
   web and watch on this flag (checked via Supabase after login).

### Unit economics at scale

| Scenario | Math | Revenue |
|----------|------|---------|
| 1,000 downloads, 10% conversion | 100 × $9.99 | **$999** (one-time) |
| 5,000 downloads, 10% conversion | 500 × $9.99 | **$4,995** |
| 10,000 downloads, 10% conversion | 1,000 × $9.99 | **$9,990** |

App store takes 30% (15% for small developers via Google/Apple small business programs):

| Scenario | After 15% store cut | After 30% store cut |
|----------|--------------------|--------------------|
| 1,000 / 10% | $849 | $699 |
| 10,000 / 10% | $8,492 | $6,993 |

### Infrastructure costs at scale

| Service | Free tier limit | Paid tier |
|---------|----------------|-----------|
| Supabase | 50K MAU, 500 MB DB, 2 GB file storage | Pro: $25/month (~100K MAU) |
| Cloudflare Pages | Unlimited requests | Free forever |
| Apple Developer | N/A | $99/year |
| Google Play | N/A | $25 one-time |
| Stripe | N/A | 2.9% + $0.30 per transaction |

**Break-even:** 3–4 Pro sales per month at $9.99 covers Supabase Pro ($25/month). Everything
above that is profit. Apple and Google store cuts are only paid when you earn.

---

## 8. Visual Rebrand — Methodology

The current UI is built on shadcn/ui + Tailwind defaults. It works well but looks generic.
A distinctive brand requires 6 targeted changes — none of them require rewriting the component
library.

### Step 1 — Brand token file (do this first)

Create `src/styles/brand.css` as a single source of truth for all brand decisions:

```css
:root {
  /* Brand palette — replace these to rebrand the entire app */
  --brand-primary: 221 83% 53%;      /* HSL: default Tailwind blue-500 — override */
  --brand-primary-foreground: 0 0% 100%;
  --brand-accent: 142 71% 45%;       /* green — used for focus time */
  --brand-danger: 0 72% 51%;         /* red — distraction */
  --brand-neutral: 38 92% 50%;       /* amber — neutral */

  /* Typography */
  --font-brand: 'Inter', system-ui, sans-serif;      /* replace with your chosen font */
  --font-mono-brand: 'JetBrains Mono', monospace;    /* for timer display */

  /* Radii — slightly more distinctive than Tailwind default */
  --radius-card: 1rem;
  --radius-chip: 9999px;
}
```

Import it in `src/main.tsx` (or `index.css`). Then update `tailwind.config.ts` to reference
these CSS variables instead of hardcoded values.

### Step 2 — Replace accent colors in Tailwind config

```typescript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      brand: {
        DEFAULT: 'hsl(var(--brand-primary))',
        foreground: 'hsl(var(--brand-primary-foreground))',
      },
    },
  },
}
```

Replace `blue-500`/`blue-600` references in component classes with `brand` / `brand-600`.
This is a grep-and-replace operation: ~15–20 files, 30 minutes.

### Step 3 — Replace the app name string

Once you have chosen a new brand name:

```bash
grep -r "Focus-TimeLog\|FocusLog\|Focus Log" src/ --include="*.tsx" --include="*.ts" -l
```

Typically ~12–15 files (LoginScreen, AppShell, Settings, manifest, page titles, meta tags).
All replaceable in under an hour.

### Step 4 — Slightly more distinctive card/border-radius

Replace the default `rounded-lg` (8px) with `rounded-xl` (12px) on cards, or the custom
`var(--radius-card)` from Step 1. This alone makes the UI feel less "shadcn default."

### Step 5 — Custom logo SVG

Design (or commission) a simple SVG logo — a wordmark or an icon + wordmark. Replace the
text-only header in `AppShell.tsx`:

```tsx
// Before
<span className="font-bold">FocusLog</span>

// After
<img src="/logo.svg" alt="YourBrandName" className="h-6" />
```

The SVG should work on both dark and light backgrounds — use `currentColor` fills or separate
dark/light variants.

### Step 6 — PWA manifest + meta theme-color

Update `public/manifest.json` and `index.html` with brand colors (covered in §5). The
`theme-color` meta tag controls the browser chrome color on Android — this is the most visible
"native feel" change and takes 5 minutes.

### Visual rebrand effort summary

| Step | Effort | Impact |
|------|--------|--------|
| Brand token file | 1 hour | High — enables all subsequent steps |
| Tailwind accent colors | 30 min | Medium — consistent color system |
| App name replacement | 30 min | High — brand identity |
| Card border-radius | 15 min | Low-medium — distinctive feel |
| Custom logo SVG | 2–8 hours (design time) | High — visual identity |
| PWA manifest + theme-color | 15 min | Medium — native app feel |

**Total code work:** ~3–4 hours. Design time (logo, palette) varies.

---

*Document prepared: June 2026.*
*Update this document when pricing, brand name, or publishing status changes.*
