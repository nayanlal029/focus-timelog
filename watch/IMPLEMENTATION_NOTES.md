# Implementation Notes — Wear OS Companion

This documents what's implemented in the scaffold and what remains, so the project can be opened
in Android Studio and finished/run.

## What's implemented

| Area | Files | Status |
|---|---|---|
| Gradle project (root + `wear` module) | `settings.gradle.kts`, `build.gradle.kts`, `wear/build.gradle.kts` | Done — public config injected via `secrets.properties` → `BuildConfig` |
| Manifest, permissions, services | `wear/src/main/AndroidManifest.xml` | Done (standalone app, FGS, Tile) |
| Supabase client | `data/SupabaseProvider.kt` | Done (Auth + Postgrest, same URL/anon key as web) |
| Models / DB mapping | `data/Models.kt` | Done — `TimeBlockInsert` uses exact snake_case DB columns |
| One-time Google sign-in + session restore | `auth/AuthManager.kt`, `auth/SessionStore.kt` | Done (Credential Manager → `signInWith(IDToken)`, encrypted token storage) |
| Categories read + cache | `data/SupabaseRepository.kt`, `data/local/*` | Done (Room cache, offline-first) |
| Time block write + offline queue | `data/SupabaseRepository.kt`, `data/SyncWorker.kt` | Done (queue-first, WorkManager retry) |
| Timer state machine + break logic | `viewmodel/TimerViewModel.kt` | Done — start/pause/resume/stop; break block on pause, distraction/break timer starts on pause |
| Background timer | `service/TimerForegroundService.kt` | Done (FGS + ongoing notification, survives process death via Room) |
| UI (3 screens + sign-in) | `presentation/*` | Done (picker, active timer, stop confirm) |
| Tile (one-tap glance) | `tile/FocusTileService.kt` | Done (opens app; shows running state) |

## Setup required before first run (in Android Studio)

1. `cp secrets.defaults.properties secrets.properties` and fill `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `GOOGLE_WEB_CLIENT_ID` (the Google Web client ID that Supabase Auth uses).
2. Register the app's debug SHA-1 in the Google Cloud OAuth Android client.
3. Let Android Studio sync Gradle (it will fetch the wrapper jar; only
   `gradle-wrapper.properties` is committed here).
4. Provide a PNG fallback launcher icon for pre-API-26 if you lower `minSdk` (currently 30, so the
   adaptive icon is sufficient).

## Known TODO / polish (out of scope for this scaffold)

- Ongoing Activity API integration (`androidx.wear.ongoing`) to surface the live timer in the
  Recents carousel — dependency is included, wiring is not yet added to the service.
- Haptics on start/stop (web app uses the Vibration API; mirror with `Vibrator`/`VibratorManager`).
- Rotary input focus handling refinements on `ScalingLazyColumn`.
- Voice-to-text note entry (intentionally omitted for v1).
- Instrumented tests + a Wear screenshot test for each screen.

## Verification (matches the plan)

- Sign in with the same Google account as the web app → category picker shows the identical list.
- Start "Work", stop after ~1 min → block appears in the web app's Today timeline within seconds.
- Start, pause 30s (break/distraction timer counts up), resume, stop → web app shows the activity
  block plus an `is_break = true` Break block for the pause window.
- Airplane mode → log a block → re-enable network → `SyncWorker` flushes it to Supabase.
- Force-stop the app mid-timer, reopen → timer still running with correct elapsed.
