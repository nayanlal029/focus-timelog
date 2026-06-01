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

- **Fork source:** `nayanlal029/focus-timelog` (branch `claude/write-product-document-iKHKL`)
- **Original project built with:** Lovable (AI web builder) — Lovable dependencies must be
  stripped from the new fork (see §7 for the exact 7 changes required)
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
| Real-time | Supabase Realtime (`postgres_changes`) |
| Build | Vite 7 + `@cloudflare/vite-plugin` |
| Hosting | Cloudflare Pages (`wrangler.jsonc`) |
| Export | ExcelJS |
| Forms | react-hook-form + Zod |
| Toasts | Sonner |
| Watch app | Kotlin + Jetpack Compose for Wear OS |
| Watch backend | Same Supabase project — no schema changes needed |
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
| type | enum | `focus` / `distraction` / `neutral` |
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
| type | enum | `focus` / `distraction` / `neutral` |
| start_ms | bigint | Unix epoch ms |
| end_ms | bigint | Unix epoch ms |
| note | text | optional |
| link | text | URL (Chrome import only) |
| is_break | boolean | true for auto-generated break segments |
| created_at / updated_at | timestamptz | |

Index: `(user_id, start_ms DESC)`

### `user_profiles`
| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID PK | FK → auth.users ON DELETE CASCADE |
| handle | text UNIQUE | 3–20 chars `[a-z0-9_]` e.g. `nlal029` |
| email | text | denormalized — enables unauthenticated handle→email lookup |
| created_at / updated_at | timestamptz | |

RLS: public SELECT (unauthenticated handle→email lookup); INSERT/UPDATE = own row only.
Index: `user_profiles_handle_idx ON (handle)`.
Seeded: `nlal029` → `nayanlal029@gmail.com`.

---

## 5. Web app — features built

### Authentication (`src/components/auth/LoginScreen.tsx`)
- Email + password (Supabase Auth)
- **User ID / handle login** — type `nlal029` instead of email; resolves via `user_profiles`
- Google OAuth (currently via Lovable broker — will switch to direct Supabase OAuth in fork)
- Signup auto-generates a handle (email prefix + 3-digit random suffix)
- Forgot password flow
- Guest mode (localStorage only, no sync)

### Timer / Today Screen (`src/routes/index.tsx`)
- Horizontal chip row (focus-first; 1 tap to start)
- Running / Paused / Idle states
- Auto-break blocks: pause → Break block starts; resume → Break block closes
- Add Past Activity (bottom sheet: category + start/end time + note)
- Today's timeline (reverse-chrono, paginated 20/page, multi-select delete)

### Focus Mode (`src/components/timer/FocusMode.tsx`)
- Fullscreen overlay; controls auto-hide after 3.5s; 250ms tick; haptic feedback

### Dashboard (`src/routes/dashboard.tsx`)
- Presets: Today / 7d / 30d / 90d / All / Custom
- Summary cards: Focus / Distraction / Neutral total time
- Mini stats: Sessions, Focus%, Avg Session
- Stacked bar chart (per day, focus + distraction)
- Top 5 Focus + Top 5 Distraction categories

### History (`src/routes/history.tsx`)
- Month calendar with per-day focus/distraction mini-bar
- Day detail: Hour Gantt chart + Activity timeline

### Settings (`src/routes/settings.tsx`)
- Account: email + `@handle` (inline edit with format + uniqueness validation)
- Theme: dark (default) / light
- Export to Excel (ExcelJS, date range picker)
- Import Chrome History (JSON, 40+ domain rules, preview before commit)
- Delete All Data (two-step confirmation)

### Category Management (within Settings)
- Create / Edit / Delete / Reorder; types: Focus / Distraction / Neutral
- Built-in defaults: Work, Work-Meet, Study, Study-Product, Gym, Podcast, Social-Insta, Break

### Chrome History Import (`src/lib/focuslog/chromeImport.ts`)
- Google Takeout JSON or Quick Chrome History Export
- 40+ hostname rules → category + type; gap-based segmentation; deduplication; preview before commit

### Real-time sync
- Supabase Realtime `postgres_changes` on `time_blocks` + `categories`
- Optimistic updates; first-login localStorage migration

### User ID / Handle (`src/lib/focuslog/handle.ts`)
- `suggestHandle(email)`, `emailForHandle(handle)`, `saveHandle()`, `fetchHandle()`, `isValidHandle()`

---

## 6. Watch app — status and structure

**Location:** `watch/` directory.
**Build:** Android Studio only — `gradlew` wrapper NOT committed; always use **▶ Run** button.
**Target:** Samsung Galaxy Watch 7 (SM-L315F), Wear OS 5.1 / API 35.
**Status:** Fully functional on Wear OS emulator; physical watch deployment in progress.

### Authentication
- **Primary:** User ID + password — type `nlal029` + password on the watch
- **Alternative:** Email + password (toggle on sign-in screen)
- **Google:** Commented out — `NoCredentialException` until SHA-1 fingerprint registered in
  Google Cloud Console Android OAuth client

### Secrets (`watch/secrets.properties` — git-ignored, must exist locally)
```
SUPABASE_URL=https://oajcauenacyxwmosfcva.supabase.co
SUPABASE_ANON_KEY=<anon key from web app .env>
GOOGLE_WEB_CLIENT_ID=<Google Web OAuth client ID from Supabase Auth settings>
```

### Screens
1. **Home** — `HorizontalPager`: Play page (MRU categories + today's stats) + Settings page
2. **Active Timer** — HH:MM:SS + wall clock `HH:mm`; ambient = timer only; screen stays on
3. **Stop Confirm** — confirm / cancel icon buttons
4. **Day Summary** — post-stop; focus (green/large) + distraction/neutral; tap → full summary
5. **Add Category** — RemoteInput text + type selector
6. **Sign-In** — User ID / email toggle + password

### Key watch features
- Offline queue: Room + WorkManager (blocks flush on reconnect)
- Pomodoro: default ON, persisted via DataStore, 25+5 min; 3×3×3 vibration on period end
- MRU sort; default category seeding (Work, Study, Exercise, Personal, Break/Lunch, Social)
- OngoingActivity notification chip (Recents + complications)
- Battery: 1s (active), 15s (ambient), 30s (idle)
- Handle shown in Settings tab

### Watch commit history (source branch `claude/write-product-document-iKHKL`)
| Commit | Description |
|--------|-------------|
| `eee0d24` | Button fix; home stat bar; wall clock; 15s ambient tick |
| `0b03fa0` | Comment out hardware button (Wear OS platform limit) |
| `20ae80b` | Google auth hardening; Pomodoro auto-break; OngoingActivity |
| `dbba1de` | Screen keep-on; Pomodoro default ON; 3×3×3 vibration; 30s idle tick |
| `ad4cfa4` | Auth hardening; sync diagnostics in Settings |
| `6a37441` | Fix Kotlin imports + runCatching type arg |
| `c48630d` | User ID handle: model, signInWithHandle, StateFlow, Settings display |

---

## 7. De-Lovable changes required in the new fork

The source repo (`nayanlal029/focus-timelog`) still has Lovable dependencies. Apply these
**7 changes** in the new repo as the first task.

### 7.1 `package.json` — remove 2 packages + rename
```diff
- "@lovable.dev/cloud-auth-js": "^1.1.2",          // in dependencies
- "@lovable.dev/vite-tanstack-config": "^1.7.0",   // in devDependencies
- "name": "tanstack_start_ts",
+ "name": "<your-brand-name>",
```

### 7.2 `vite.config.ts` — replace Lovable wrapper with direct plugins
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
> Note: if `@tanstack/react-start/plugin/vite` fails, check `node_modules/@tanstack/react-start`
> for the correct export path — it may be `/vite` or `/plugin/vite` depending on version.

### 7.3 `src/integrations/lovable/index.ts` — replace with direct Supabase OAuth
Replace the entire file:
```ts
// Direct Supabase OAuth — replaces @lovable.dev/cloud-auth-js broker
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
`LoginScreen.tsx` is **unchanged** — it still calls `lovable.auth.signInWithOAuth("google", ...)`.

### 7.4 `src/routes/__root.tsx` — replace og:image + update title
```diff
- { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/...lovable.app....png" },
- { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/...lovable.app....png" },
+ { property: "og:image", content: "/og-image.png" },
+ { name: "twitter:image", content: "/og-image.png" },
  { title: "FocusLogNL" },   // ← also rename to new brand name
```

### 7.5 `bunfig.toml` — remove Lovable exclusion
```diff
- minimumReleaseAgeExcludes = ["@lovable.dev/vite-tanstack-config"]
```

### 7.6 `src/lib/focuslog/chromeImport.ts` — remove "lovable" from domain regex
Around line 41, remove `lovable|` from the focus-classification hostname regex.

### 7.7 Delete `src/integrations/lovable/` directory
The whole directory was auto-generated by Lovable. After 7.3 replaces the index.ts, delete it.

---

## 8. Google OAuth setup (after stripping Lovable)

1. **Google Cloud Console** → APIs & Services → Credentials → Create OAuth 2.0 Client ID
   - Type: Web application
   - Authorized redirect URI: `https://oajcauenacyxwmosfcva.supabase.co/auth/v1/callback`
2. **Supabase Dashboard** → Authentication → Providers → Google
   - Enable → paste Client ID + Client Secret
3. Test the "Continue with Google" button on the login screen

---

## 9. Local development

```bash
git clone https://github.com/nayanlal029/<new-repo-name>.git
cd <new-repo-name>
bun install
cp .env.example .env   # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
bun run dev            # http://localhost:5173
bun run build          # production build → .cloudflare/
```

Verify after de-Lovable: `bun install` should show zero `@lovable.dev` packages in the lock file.

---

## 10. Priorities for the new session (in order)

| # | Task | Effort |
|---|------|--------|
| P0 | Apply de-Lovable changes (§7) + `bun install` + `bun run build` smoke test | 1 hour |
| P1 | Google OAuth setup (§8) | 30 min |
| P2 | PWA manifest + icons (`public/manifest.json` + 192/512 PNGs) | 1 hour |
| P3 | Brand rename (once name decided: update `__root.tsx`, `AppShell.tsx`, `package.json`, `wrangler.jsonc`) | 1–2 hours |
| P4 | Stripe monetization — `is_pro` column, Edge Function webhook, Checkout button | 1–2 days |
| P5 | Physical watch deployment (watch on charger + wireless ADB — see `watch/SESSION_REFERENCE.md §8`) | 1–2 hours |

---

## 11. Monetization plan

**Recommended pricing:** Free tier + **$9.99 one-time Pro** purchase

| Tier | Price | Features |
|------|-------|---------|
| Free | $0 | Web app, 30-day history, up to 5 categories |
| Pro | $9.99 once | Unlimited history, Excel export, Chrome import, Watch app, unlimited categories |

**Implementation:**
1. Add `is_pro boolean DEFAULT false` to `user_profiles`
2. Supabase Edge Function `handle-stripe-webhook` → sets `is_pro = true` on payment
3. Stripe Checkout button in Settings (one-time payment link)
4. Gate Pro features: check `user.is_pro` before allowing export/import/watch

**Economics:** ~3 Pro sales/month covers Supabase Pro ($25/month). Google/Apple take 15–30%.

---

## 12. Brand decisions pending

| Decision | Status |
|----------|--------|
| Brand name | ⏳ Not chosen — must be invented/arbitrary (not descriptive) for trademark |
| Color palette | ⏳ Currently Tailwind defaults — update `src/index.css` CSS custom properties |
| Logo SVG | ⏳ Replace text header in `AppShell.tsx` |
| USPTO trademark | ⏳ File after name chosen; Class 42; ~$250–350 via TEAS Plus |
| Domain | ⏳ Register `.com` + `.app` after name chosen (~$12–20/yr each) |

Full strategy: see `STRATEGY.md` in the source repo.

---

## 13. Key files reference

| Purpose | Path |
|---------|------|
| Auth context | `src/lib/auth-context.tsx` |
| All time-tracking state | `src/lib/focuslog/focuslog-context.tsx` |
| Supabase client | `src/integrations/supabase/client.ts` |
| Google OAuth wrapper (to replace) | `src/integrations/lovable/index.ts` |
| Handle utilities | `src/lib/focuslog/handle.ts` |
| Chrome import parser | `src/lib/focuslog/chromeImport.ts` |
| Timer screen | `src/routes/index.tsx` |
| Dashboard | `src/routes/dashboard.tsx` |
| History | `src/routes/history.tsx` |
| Settings | `src/routes/settings.tsx` |
| Login screen | `src/components/auth/LoginScreen.tsx` |
| App shell (nav tabs) | `src/components/layout/AppShell.tsx` |
| Root layout (head/meta) | `src/routes/__root.tsx` |
| Cloudflare deploy config | `wrangler.jsonc` |
| Watch entry point | `watch/wear/src/main/java/.../presentation/MainActivity.kt` |
| Watch auth | `watch/wear/src/main/java/.../auth/AuthManager.kt` |
| Watch timer logic | `watch/wear/src/main/java/.../viewmodel/TimerViewModel.kt` |
| Watch Supabase repo | `watch/wear/src/main/java/.../data/SupabaseRepository.kt` |

---

## 14. Env vars

### Web (`.env`)
```
VITE_SUPABASE_URL=https://oajcauenacyxwmosfcva.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

### Cloudflare Pages (production — set in Pages dashboard)
Same two vars as above.

### Watch (`watch/secrets.properties` — git-ignored)
```
SUPABASE_URL=https://oajcauenacyxwmosfcva.supabase.co
SUPABASE_ANON_KEY=<same anon key>
GOOGLE_WEB_CLIENT_ID=<Google Web OAuth client ID>
```

---

*This document covers the full state of the project as of June 2026.*
*Update after major features are added or architecture changes.*
