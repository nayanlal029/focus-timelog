# CLAUDE.md

Guidance for AI agents (Claude Code and others) working in this repository.
Keep this file accurate when you change architecture, commands, or conventions.

## What this is

**FocusLog** (repo `focus-timelog`) — a mobile-first web app for logging your day
as one continuous **focus vs. distraction** timeline, with a dashboard, history,
Excel export, Chrome-history import, and a Wear OS companion. See
`PRODUCT_DOCUMENT.md` for the full product/feature spec.

This project was originally built on **Lovable** and has been **decoupled** from
it — it builds, runs, and deploys with no Lovable dependency, packages, or
registry. Do not reintroduce `@lovable.dev/*` packages, the private
`*.pkg.dev/lovable-core*` registry, or a `.lovable/` folder.

## Stack (verify here before assuming)

| Layer | Tech |
|-------|------|
| Framework | React 19 + TypeScript 5.8 on **TanStack Start** (SSR) |
| Routing | TanStack Router (file-based, `src/routes/`) |
| Data/query | TanStack Query 5 |
| Backend | **Supabase** (PostgreSQL + Auth + Realtime) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) + Radix UI / shadcn primitives |
| Build | Vite 7 |
| Runtime/host | **Cloudflare Workers** (SSR), entry `src/server.ts`, config `wrangler.jsonc` |
| Package manager | **bun** (`bunfig.toml`) |

## Commands

```bash
bun install          # install deps (public npm registry)
bun run dev          # local dev server (Vite)
bun run build        # production build → dist/ (client + Cloudflare Worker)
bun run preview      # preview the production build
bun run lint         # eslint (see note below)
bun run format       # prettier --write .
bunx tsc --noEmit    # typecheck (build uses esbuild and does NOT type-check)
# deploy: bun run build && wrangler deploy
```

**Lint note:** the repo is **not** prettier-clean on `main` (a large pre-existing
backlog of `prettier/prettier` errors). `bun run lint` is therefore red for
reasons unrelated to most changes. Do **not** mass-reformat files you aren't
otherwise editing — it buries real diffs. Match the surrounding style instead.

## Layout

```
src/
  routes/                 TanStack Router routes: __root, index (Today), dashboard,
                          history, settings, changelog, reset-password.
                          routeTree.gen.ts is GENERATED — never hand-edit it.
  server.ts               Cloudflare Worker fetch entry; wraps the TanStack Start
                          SSR handler with a branded error page. wrangler `main`.
  components/
    auth/                 LoginScreen (email/password + Google OAuth + guest).
    focuslog/             Feature UI: TodayScreen, Timeline, FocusMode, AppShell,
                          FilterPanel, etc.
    ui/                   shadcn/Radix primitives (generic, rarely edited).
  lib/
    auth-context.tsx      Supabase session + guest mode (AuthProvider/useAuth).
    focuslog/             Domain logic:
      context.tsx           FocusLogProvider — categories/blocks/active-timer state.
      storage.ts            localStorage load/save + core types (ActiveState, etc.).
      aggregate.ts          Overlap-clamped time totals (dashboard/history math).
      alerts.ts             Pomodoro + recurring reminders + pause alerts (useTimerAlerts).
      chromeImport.ts       Parse Chrome history export → categorized blocks.
      export.ts             Excel (.xlsx) export via ExcelJS.
      handle.ts             @user-id handle claim/lookup.
      format.ts / sound.ts  Formatting helpers; WebAudio beep + navigator.vibrate.
      filter-context.tsx    History/dashboard filter state.
  integrations/supabase/
    client.ts             Browser client (anon/publishable key). Lazy Proxy.
    client.server.ts      Server-only client (service-role key; bypasses RLS).
    auth-middleware.ts     TanStack server-fn middleware: verify Bearer token.
    types.ts              Generated DB types.
watch/                    Wear OS (Galaxy Watch) companion — separate app.
```

## State & data model

- App state lives in **React context + localStorage**; Supabase provides cloud
  sync via Realtime `postgres_changes`. See `PRODUCT_DOCUMENT.md` §5, §8.
- **Guest mode** (`localStorage["focuslog.guest"]`) runs the whole app with no
  account — data stays local, no Supabase hydrate/subscribe.
- `alerts.ts` reads its config from localStorage **live** at each schedule tick,
  so Settings changes take effect without a remount.

## Auth

- Supabase email/password, **native Supabase Google OAuth**
  (`supabase.auth.signInWithOAuth({ provider: "google" })`), and guest mode.
- Google OAuth is brokered by **Supabase directly** (not Lovable). It requires
  the Google provider to be configured in the **Supabase dashboard**
  (Authentication → Providers) with the app's redirect URL. Email/password and
  guest mode need no extra config.

## Environment & deploy

- `.env` holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_SUPABASE_PROJECT_ID` (and non-`VITE_` mirrors for SSR). The
  `VITE_*`/publishable (anon) keys are **safe to ship** in the client bundle;
  security relies on Supabase **RLS**, which is enabled.
- Vite inlines `import.meta.env.VITE_*` at **build time** into both the client
  and Worker bundles — so `.env` must be present when you `bun run build`.
- Server-only secrets (e.g. `SUPABASE_SERVICE_ROLE_KEY`, used by
  `client.server.ts`) are **not** committed and must be set as Cloudflare Worker
  secrets at runtime. Never expose the service-role key to client code.

## Conventions

- **Colors:** use semantic Tailwind tokens only (`bg-focus`, `bg-distraction`,
  `bg-accent`, `text-muted-foreground`, …). No hardcoded hex/rgb.
- **Imports:** `@/` → `src/` (via `vite-tsconfig-paths` + `tsconfig.json` paths).
- **Generated files — do not hand-edit:** `src/routeTree.gen.ts`,
  `src/integrations/supabase/types.ts`. Files under `src/integrations/supabase/`
  carry an "automatically generated" header from the original Supabase codegen;
  they are now maintained here, but keep changes minimal and intentional.
- No `process.env` in client code paths; use `import.meta.env.VITE_*` (with the
  existing `process.env` fallback only for the SSR/server clients).

## Build config

`vite.config.ts` composes the plugins explicitly (`tailwindcss`,
`vite-tsconfig-paths`, `@cloudflare/vite-plugin`, `@tanstack/react-start`,
`@vitejs/plugin-react`). It previously came from `@lovable.dev/vite-tanstack-config`;
that wrapper's dev/sandbox-only extras (component tagger, HMR gate, dev-server
bridge, SSR error loggers, sandbox detection) were intentionally dropped and are
**not** part of this config.
