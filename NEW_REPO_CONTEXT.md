# Focus-TimeLog — New Repo Context Document

> Attach this file at the start of any Claude Code session to give full project context.
> Last updated: June 2026.

---

## 1. What this project is

A **mobile-first time-tracking web app + Galaxy Watch 7 companion app**. Users log focus
sessions (Work, Study, etc.) as a continuous timeline. The app classifies every minute as
Focus, Distraction, or Neutral and shows a daily dashboard. A standalone Wear OS app lets
users start/stop timers from the wrist without touching their phone.

**Core loop:** tap a category → start timer → stop → review timeline → improve tomorrow.

---

## 2. Repo origin

- **Forked from:** `nayanlal029/focus-timelog` (branch `claude/write-product-document-iKHKL`)
- **Original project built with:** Lovable (AI web builder) — all Lovable dependencies must be
  stripped from this fork (see §7 for exact changes needed)
- **Supabase project:** `oajcauenacyxwmosfcva` (the real project with all data and schema)
  — there is also an empty test project `maueewmudzivsfxsybvi`; ignore it

---

## 3. Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript 5.8 via **TanStack Start** (SSR) |
| Routing | TanStack React Router 1.168 |
| Data fetching | TanStack React Query 5 |
| Styling | Tailwind CSS 4.2 + CSS custom properties |
| UI components | shadcn/ui built on Radix UI primitives |
| Icons | Lucide React |
| Backend / DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth — email/password + User ID (handle) + Google OAuth |
| Real-time | Supabase Realtime (postgres_changes) |
| Build | Vite 7 + @cloudflare/vite-plugin |
| Hosting | Cloudflare Pages (wrangler.jsonc) |
| Export | ExcelJS |
| Forms | react-hook-form + Zod |
| Toasts | Sonner |
| Watch app | Kotlin + Jetpack Compose for Wear OS |
| Watch backend | Same Supabase project — no schema changes |
| Package manager | Bun |

---

## 4. Database schema (Supabase)

All tables have RLS: every row is owned by `auth.uid() = user_id`.

### `categories`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID | FK → auth.users |
| name | text | e.g. "Work", "Social-Insta" |
| type | enum | focus / distraction / neutral |
| order | integer | sort order in chip row |
| builtin | boolean | true = system default, cannot delete |
| created_at / updated_at | timestamptz | |

### `time_blocks`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID | FK → auth.users |
| category_id | UUID | FK → categories |
| category_name | text | snapshot at log time (survives renames) |
| type | enum | focus / distraction / neutral |
| start_ms | bigint | Unix epoch ms |
| end_ms | bigint | Unix epoch ms |
| note | text | optional |
| link | text | URL (Chrome import only) |
| is_break | boolean | true for auto-generated break segments |
| created_at / updated_at | timestamptz | |

Index: (user_id, start_ms DESC)

### `user_profiles`
| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID PK | FK → auth.users ON DELETE CASCADE |
| handle | text UNIQUE | 3-20 chars [a-z0-9_] e.g. nlal029 |
| email | text | denormalized — enables unauthenticated handle→email lookup |
| created_at / updated_at | timestamptz | |

RLS: public SELECT (handle→email lookup without session); INSERT/UPDATE = own row only.
Index: user_profiles_handle_idx ON (handle).
Seeded: handle nlal029 → nayanlal029@gmail.com.

---

## 5. Web app — features built

### Authentication (src/components/auth/LoginScreen.tsx)
- Email + password (Supabase Auth)
- User ID / handle login — type nlal029 instead of email; resolves via user_profiles
- Google OAuth (currently Lovable broker — must replace, see §7 + §8)
- Signup auto-generates handle (email prefix + 3-digit random suffix)
- Forgot password flow
- Guest mode (localStorage only, no sync)

### Timer / Today Screen (src/routes/index.tsx)
- Horizontal chip row (focus-first; 1 tap to start)
- Running / Paused / Idle states
- Auto-break blocks: pause → Break block starts; resume → Break block closes
- Add Past Activity (bottom sheet: category + start/end time + note)
- Today's timeline (reverse-chrono, paginated 20/page, multi-select delete)

### Focus Mode (src/components/timer/FocusMode.tsx)
- Fullscreen overlay; controls auto-hide after 3.5s; 250ms tick; haptic feedback

### Dashboard (src/routes/dashboard.tsx)
- Date presets: Today / 7d / 30d / 90d / All / Custom
- Summary cards: Focus / Distraction / Neutral total time
- Mini stats: Sessions, Focus%, Avg Session
- Stacked bar chart (per day, focus + distraction)
- Top 5 Focus categories + Top 5 Distraction categories

### History (src/routes/history.tsx)
- Month calendar with per-day focus/distraction mini-bar
- Day detail: Hour Gantt chart + Activity timeline

### Settings (src/routes/settings.tsx)
- Account: email + @handle (editable inline, format + uniqueness validation)
- Theme toggle: dark (default) / light
- Export to Excel (ExcelJS, date range picker)
- Import Chrome History (40+ domain rules, preview before commit)
- Delete All Data (two-step confirmation)

### Category Management (in Settings)
- Create / Edit / Delete / Reorder
- Types: Focus (blue), Distraction (red), Neutral (amber)
- Built-in defaults: Work, Work-Meet, Study, Study-Product, Gym, Podcast, Social-Insta, Break

### Chrome History Import (src/lib/focuslog/chromeImport.ts)
- Google Takeout JSON or Quick Chrome History Export extension format
- 40+ hostname rules → category + type; gap-based segmentation; deduplication

### Excel Export — 8 columns: Date, Start, End, Duration(min), Category, Type, Note, Link

### Multi-select & Bulk Delete — toggle on timeline, bulk delete with confirmation

### Real-time sync
- Supabase Realtime postgres_changes on time_blocks + categories
- Optimistic updates; first-login localStorage migration

### Handle utilities (src/lib/focuslog/handle.ts)
- suggestHandle(email), emailForHandle(handle), saveHandle(), fetchHandle(), isValidHandle()

---

## 6. Watch app — status and structure

Location: watch/ directory in repo root
Build: Android Studio only — gradlew wrapper NOT committed
Target: Samsung Galaxy Watch 7 (SM-L315F), Wear OS 5.1 / API 35
App ID: com.focuslog.wear
Status: Fully functional on Wear OS emulator; physical watch deployment in progress

### Auth (watch)
Primary: User ID + password (type nlal029 + password)
Alternative: Email + password (toggle on sign-in screen)
Google: commented out — NoCredentialException pending SHA-1 fingerprint in GCP Android OAuth client

### Secrets (watch/secrets.properties — git-ignored, must exist locally)
```
SUPABASE_URL=https://oajcauenacyxwmosfcva.supabase.co
SUPABASE_ANON_KEY=<anon key from web app .env>
GOOGLE_WEB_CLIENT_ID=<Google Web OAuth client ID>
```

### Screens
1. Home — HorizontalPager: Play page (MRU categories + today stats) + Settings page
2. Active Timer — HH:MM:SS + wall clock HH:mm; ambient = timer only; screen stays on
3. Stop Confirm — confirm/cancel icon buttons
4. Day Summary — post-stop: focus (green/large) + distraction/neutral; tap → full summary
5. Add Category — RemoteInput text + type selector
6. Sign-In — User ID / email toggle + password field

### Key watch features
- Offline queue: Room + WorkManager (blocks flush on reconnect)
- Pomodoro: default ON, persisted via DataStore, 25+5 min; 3x3x3 vibration on period end
- MRU sort; default category seeding (Work, Study, Exercise, Personal, Break/Lunch, Social)
- OngoingActivity notification chip (Recents carousel + complications)
- Battery optimization: 1s tick (active), 15s (ambient), 30s (idle)
- Handle shown in Settings tab

### Watch commit history (source branch: claude/write-product-document-iKHKL)
| Commit | Description |
|--------|-------------|
| eee0d24 | Button fix; home stat bar; wall clock HH:mm; 15s ambient tick |
| 0b03fa0 | Comment out hardware button (KEYCODE_STEM_PRIMARY reserved by Wear OS) |
| 20ae80b | Google auth nonce; Pomodoro auto-break; OngoingActivity; icon buttons |
| dbba1de | Screen keep-on (full session); Pomodoro default ON; 3x3x3 vibration; 30s idle tick |
| ad4cfa4 | Auth hardening; sync diagnostics (pending count + retry chip in Settings) |
| 6a37441 | Fix Kotlin imports (Log, MessageDigest, UUID) + runCatching<Unit> type arg |
| c48630d | User ID handle: UserProfile model, signInWithHandle, StateFlow, Settings display |

---

## 7. De-Lovable changes — MUST apply to this fork

These changes have NOT yet been applied to the new repo. Apply them in order.

### 7.1 package.json — remove 2 packages, rename
Remove from dependencies: "@lovable.dev/cloud-auth-js": "^1.1.2"
Remove from devDependencies: "@lovable.dev/vite-tanstack-config": "^1.7.0"
Change "name": "tanstack_start_ts" → your brand name

### 7.2 vite.config.ts — replace Lovable wrapper with direct plugins
Current: import { defineConfig } from "@lovable.dev/vite-tanstack-config"
Replace entire file with:

```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    cloudflare(),
  ],
});
```

Note: if @tanstack/react-start/plugin/vite fails, check node_modules/@tanstack/react-start
for the correct export path (may be /vite or /plugin).

### 7.3 src/integrations/lovable/index.ts — replace with direct Supabase OAuth
Replace entire file. LoginScreen.tsx call signature stays the same, no changes needed there:

```ts
import { supabase } from "../supabase/client";

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google", opts?: { redirect_uri?: string }) => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: opts?.redirect_uri ?? window.location.origin },
      });
      return { error: error ?? null };
    },
  },
};
```

### 7.4 src/routes/__root.tsx — fix og:image URLs
Replace both og:image and twitter:image (currently pointing at Lovable's R2 CDN):
  { property: "og:image", content: "/og-image.png" }
  { name: "twitter:image", content: "/og-image.png" }
Create public/og-image.png placeholder (1200x630px).
Update title/og:title from "FocusLogNL" to new brand name.

### 7.5 bunfig.toml — remove Lovable exclusion
Remove: minimumReleaseAgeExcludes = ["@lovable.dev/vite-tanstack-config"]

### 7.6 src/lib/focuslog/chromeImport.ts — clean domain regex
Remove "lovable" from the focus-classification hostname regex (~line 41).

### 7.7 Verify the fork works
```bash
bun install          # no @lovable.dev packages in lockfile
bun run build        # compiles clean
bun run dev          # login screen loads; email/password login works
```

---

## 8. Google OAuth setup (after de-Lovable)

1. Google Cloud Console → Credentials → Create OAuth 2.0 Client ID (Web application)
   Authorized redirect URI: https://oajcauenacyxwmosfcva.supabase.co/auth/v1/callback
2. Supabase Dashboard → Auth → Providers → Google → Enable → paste Client ID + Secret
3. Test: "Continue with Google" on login screen works without Lovable redirect

---

## 9. Local development

```bash
git clone https://github.com/nayanlal029/<new-repo>.git && cd <new-repo>
bun install
cp .env.example .env   # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
bun run dev            # http://localhost:5173
bun run build          # production build for Cloudflare Pages
```

---

## 10. Session priorities (work in this order)

| # | Task | Effort |
|---|------|--------|
| P0 | Apply de-Lovable changes (§7) + verify build | 1 hour |
| P1 | Custom Google OAuth (§8) | 30 min |
| P2 | PWA manifest + icons (public/manifest.json + public/icons/) | 1 hour |
| P3 | Brand rename — grep + replace ~15 files | 1 hour |
| P4 | Stripe: is_pro flag + Checkout button + feature gates | 1-2 days |
| P5 | Physical watch deployment (wireless ADB, watch on charger) | 1 session |

---

## 11. Monetization plan

Recommended: Free + $9.99 one-time Pro purchase

| Tier | Price | Features |
|------|-------|---------|
| Free | $0 | Web app, 30-day history, 5 categories |
| Pro | $9.99 once | Unlimited history, export, import, watch app, unlimited categories |

Implementation:
1. Add is_pro boolean DEFAULT false to user_profiles (new migration)
2. Supabase Edge Function stripe-webhook → flip is_pro=true on checkout.session.completed
3. Stripe Checkout button in Settings → one-time $9.99
4. Gate Pro features on is_pro in both web and watch

Break-even: ~3 sales/month covers Supabase Pro ($25/mo). Full economics in STRATEGY.md.

---

## 12. Env vars & secrets

Web (.env):
```
VITE_SUPABASE_URL=https://oajcauenacyxwmosfcva.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Watch (watch/secrets.properties — git-ignored):
```
SUPABASE_URL=https://oajcauenacyxwmosfcva.supabase.co
SUPABASE_ANON_KEY=<same anon key>
GOOGLE_WEB_CLIENT_ID=<Google Web OAuth client ID>
```

Cloudflare Pages production: set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in Pages dashboard.

---

## 13. Key files reference

| Purpose | File |
|---------|------|
| Auth context | src/lib/auth-context.tsx |
| All time-tracking state + mutations | src/lib/focuslog/focuslog-context.tsx |
| Supabase client | src/integrations/supabase/client.ts |
| Google OAuth wrapper (replace this) | src/integrations/lovable/index.ts |
| Handle utilities | src/lib/focuslog/handle.ts |
| Chrome import parser | src/lib/focuslog/chromeImport.ts |
| Timer / Today screen | src/routes/index.tsx |
| Dashboard | src/routes/dashboard.tsx |
| History | src/routes/history.tsx |
| Settings | src/routes/settings.tsx |
| Login screen | src/components/auth/LoginScreen.tsx |
| App shell (nav tabs) | src/components/layout/AppShell.tsx |
| Root layout + meta tags | src/routes/__root.tsx |
| Cloudflare Pages config | wrangler.jsonc |
| Watch entry point | watch/wear/src/main/java/.../presentation/MainActivity.kt |
| Watch auth | watch/wear/src/main/java/.../auth/AuthManager.kt |
| Watch timer logic | watch/wear/src/main/java/.../viewmodel/TimerViewModel.kt |
| Watch Supabase repo | watch/wear/src/main/java/.../data/SupabaseRepository.kt |
| Watch settings (DataStore) | watch/wear/src/main/java/.../data/WatchSettings.kt |

---

## 14. Brand decisions still pending

| Decision | Status | Notes |
|----------|--------|-------|
| Brand name | Not chosen | Must be invented/arbitrary for trademark — avoid descriptive |
| Color palette | Not chosen | Update tailwind.config.ts + src/index.css when ready |
| Logo SVG | Not designed | Replace text header in AppShell.tsx |
| USPTO trademark | Pending name | Class 42 (SaaS); ~$250-350 via TEAS Plus; ~18 months |
| Domain (.com + .app) | Pending name | ~$12-20/yr each via Namecheap or Cloudflare Registrar |

Full brand + go-to-market strategy: see STRATEGY.md in the repo root.

---

## 15. Reference documents (all in this repo)

| Document | Location | Purpose |
|----------|----------|---------|
| Product spec | PRODUCT_DOCUMENT.md | Full feature specs, data model, UX principles |
| Go-to-market strategy | STRATEGY.md | Brand, IP, publishing, pricing, rebrand methodology |
| Watch build log | watch/SESSION_REFERENCE.md | Chronological record of all watch development |
| Watch implementation | watch/IMPLEMENTATION_NOTES.md | Done/TODO breakdown + setup instructions |

---

*This document covers the full state of the project as of June 2026.*
*Update §10 priorities as tasks are completed.*
