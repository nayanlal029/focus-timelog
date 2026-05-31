# Focus-TimeLog — Wear OS Companion (Galaxy Watch 7)

A standalone Wear OS app that lets you log focus time from your wrist. It is a **companion** to
the web app: it only handles quick **Start / Pause / Stop** logging. Analytics, history, and
export stay in the web app. Everything you log on the watch syncs to the same Supabase backend
and shows up in the web app in real time.

## Why this exists

Pulling out a phone to start/stop a timer mid-work is friction. A glanceable wrist app removes it.

## Architecture (standalone + one-time Google sign-in)

```
Galaxy Watch 7 (Wear OS 5, own WiFi/LTE)
  └─ one-time Google sign-in (Credential Manager → Google ID token)
       └─ supabase.auth.signInWith(IDToken)  → session stored encrypted on watch
            ├─ SELECT categories   (cached in Room for offline use)
            └─ INSERT time_blocks  (offline queue + WorkManager retry)
                 └─ Supabase Realtime → web app shows the block live
```

No phone companion app. No DB schema changes — the watch is just another Supabase REST client,
subject to the same RLS (`auth.uid() = user_id`).

## Modules

- `wear/` — the Wear OS app (Kotlin + Jetpack Compose for Wear OS).

## Prerequisites

- Android Studio (Hedgehog or newer) with the Wear OS SDK.
- A Wear OS emulator (use the "Galaxy Watch 4/5/6 Wear OS" profile — functionally equivalent to
  Watch 7 for app dev) or a physical Galaxy Watch 7 in developer mode.
- A Google **Web** OAuth client ID, the same one configured as the Google provider in your
  Supabase project's Auth settings. The watch sends a Google ID token minted for this client ID
  to `signInWith(IDToken)`.
- Your Android app's SHA-1 registered in the Google Cloud console OAuth client (Android client).

## Configuration

Copy `wear/secrets.defaults.properties` to `secrets.properties` (git-ignored) at the project root
and fill in:

```properties
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-ANON-KEY
GOOGLE_WEB_CLIENT_ID=YOUR-WEB-OAUTH-CLIENT-ID.apps.googleusercontent.com
```

These map to the same public values the web app exposes via `VITE_SUPABASE_URL` /
`VITE_SUPABASE_PUBLISHABLE_KEY`. They are injected into `BuildConfig` at build time
(see `wear/build.gradle.kts`).

## Build & run

```bash
cd watch
./gradlew :wear:installDebug      # installs on a connected watch / running emulator
```

## Status

This is a scaffold with the full app structure and core logic implemented. It is intended to be
opened and built in Android Studio — it cannot be compiled in the web session environment (no
Android SDK). See `watch/IMPLEMENTATION_NOTES.md` for what is done and what remains.
