# Implementation Notes — Wear OS Companion

This documents what's implemented in the scaffold and what remains, so the project can be opened
in Android Studio and finished/run.

## What's implemented

| Area | Files | Status |
|---|---|---|
| Gradle project (root + `wear` module) | `settings.gradle.kts`, `build.gradle.kts`, `wear/build.gradle.kts` | Done — public config injected via `secrets.properties` → `BuildConfig` |
| Manifest, permissions, services | `wear/src/main/AndroidManifest.xml` | Done (standalone app, FGS, Tile) |
| Supabase client | `data/SupabaseProvider.kt` | Done (Auth + Postgrest, same URL/anon key as web) |
| Models / DB mapping | `data/Models.kt` | Done — `TimeBlockInsert` uses exact snake_case DB columns; `UserProfile` for handle→email lookup |
| User ID (handle) sign-in | `auth/AuthManager.kt`, `presentation/SignInScreen.kt` | Done — primary cross-device login method; resolves handle via `user_profiles`, calls `signInWith(Email)` |
| One-time Google sign-in | `auth/AuthManager.kt` | Scaffolded; disabled at runtime (NoCredentialException — see Known TODO) |
| Session restore + validation | `auth/AuthManager.kt`, `auth/SessionStore.kt` | Done — `refreshCurrentSession()` validates token on every restore; stale tokens force re-login |
| Categories read + cache | `data/SupabaseRepository.kt`, `data/local/*` | Done (Room cache, offline-first, default category seeding on first sign-in) |
| Time block write + offline queue | `data/SupabaseRepository.kt`, `data/SyncWorker.kt` | Done (queue-first, WorkManager retry) |
| Timer state machine + break logic | `viewmodel/TimerViewModel.kt` | Done — start/pause/resume/stop; break block on pause, distraction/break timer starts on pause |
| Pomodoro mode | `viewmodel/TimerViewModel.kt`, `data/WatchSettings.kt` | Done — default ON, persisted via DataStore, work/break duration pickers, 3×3×3 vibration on period end |
| 3×3×3 vibration | `viewmodel/TimerViewModel.kt` | Done — 3 groups of 3 short pulses, 1 s gap between groups (VibratorManager waveform) |
| Background timer | `service/TimerForegroundService.kt` | Done (FGS + ongoing notification, survives process death via Room) |
| OngoingActivity (notification chip) | `service/TimerForegroundService.kt` | Done — surfaces live timer in Recents carousel and complications |
| Screen keep-on (full session) | `presentation/ActiveTimerScreen.kt` | Done — `FLAG_KEEP_SCREEN_ON` held for full timer session; ambient mode handles power saving |
| UI — Sign-in screen | `presentation/SignInScreen.kt` | Done — User ID / email toggle, password field, error display |
| UI — Home (Category Picker) | `presentation/CategoryPickerScreen.kt` | Done — `HorizontalPager`: Play page (MRU category list + today's stat bar) + Settings page (email, handle, Pomodoro, sleep) |
| UI — Active timer screen | `presentation/ActiveTimerScreen.kt` | Done — large HH:MM:SS; wall-clock HH:mm; ambient = timer-only + dim clock; Pause/Resume/Stop |
| UI — Stop confirmation | `presentation/StopConfirmScreen.kt` | Done — shows elapsed time; confirm / cancel icon buttons |
| UI — Day summary screen | `presentation/DaySummaryScreen.kt` | Done — post-stop: focus total (green/large) + distraction/neutral (smaller); taps through to full summary |
| UI — Add category screen | `presentation/AddCategoryScreen.kt` | Done — RemoteInput text entry + type selector; syncs to Supabase |
| Tile (one-tap glance) | `tile/FocusTileService.kt` | Done (opens app; shows running state) |
| Handle display in Settings | `presentation/CategoryPickerScreen.kt` | Done — Settings page shows `@handle` in monospace |
| MRU category sort | `data/WatchSettings.kt`, `viewmodel/TimerViewModel.kt` | Done — most-recently-used categories float to top (DataStore list, max 10) |
| Today's aggregates | `viewmodel/SummaryViewModel.kt` | Done — focus/distraction/neutral totals; tapping the stat bar opens Day Summary |
| Ambient mode + battery optimization | `viewmodel/TimerViewModel.kt`, `presentation/ActiveTimerScreen.kt` | Done — 1 s active, 15 s ambient, 30 s idle |
| Sync diagnostics | `presentation/CategoryPickerScreen.kt` | Done — Settings page shows pending block count + Retry chip |

## Setup required before first run (in Android Studio)

1. `secrets.properties` already exists locally at `watch/` — confirm `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, and `GOOGLE_WEB_CLIENT_ID` are filled (copy from the web app's `.env`).
   If starting fresh: `cp watch/secrets.defaults.properties watch/secrets.properties` and fill values.
2. The app does **not** require Google Cloud setup for basic use — User ID + password is the
   primary sign-in method. Google sign-in is commented out pending Android OAuth client registration.
3. Let Android Studio sync Gradle (it will fetch the wrapper jar; only
   `gradle-wrapper.properties` is committed here — no `gradlew` wrapper script is committed,
   so always build via the Android Studio **▶ Run** button, not CLI).
4. Provide a PNG fallback launcher icon for pre-API-26 if you lower `minSdk` (currently 30, so the
   adaptive icon is sufficient).

## Known TODO / polish (out of scope for this scaffold)

- **Google sign-in on watch** — `NoCredentialException` at runtime. Root cause: the SHA-1 debug
  fingerprint must be registered in the Android OAuth client in Google Cloud Console, and changes
  take 15–30 min to propagate. Once registered, un-comment the Google sign-in button in
  `SignInScreen.kt` and the `signInWithGoogle()` path in `AuthManager.kt`.
- **gradlew wrapper not committed** — build via Android Studio; add it (`gradle wrapper --gradle-version X`) if CLI builds are needed.
- Rotary input focus handling refinements on `ScalingLazyColumn`.
- Voice-to-text note entry (intentionally omitted for v1).
- Instrumented tests + a Wear screenshot test for each screen.
- **Wear Tile** deeper integration — Tile is implemented; future: "Start last category" action directly from Tile without opening the app.

## Verification (matches the plan)

- Sign in with User ID (`nlal029`) + password → category picker shows the correct list.
- Start "Work", stop after ~1 min → block appears in the web app's Today timeline within seconds.
- Start, pause 30s (break/distraction timer counts up), resume, stop → web app shows the activity
  block plus an `is_break = true` Break block for the pause window.
- Airplane mode → log a block → re-enable network → `SyncWorker` flushes it to Supabase.
- Force-stop the app mid-timer, reopen → timer still running with correct elapsed.
- Pomodoro ON (default) → set Work=2 min → start → at 2:00 feel 3×3 vibration, auto-break starts.
- Home stat bar → tap → Day Summary screen opens.
