# Focus-TimeLog — Galaxy Watch 7 Companion App
## Complete Build & Session Reference Document

> A chronological record of everything done to build, refine, and deploy the Wear OS
> companion app for Focus-TimeLog. User prompts are recorded **verbatim**. Searchable by
> heading, prompt text, file name, or keyword.

- **Project:** `com.focuslog.wear` (Wear OS app), part of repo `nayanlal029/focus-timelog`
- **Branch:** `claude/write-product-document-iKHKL`
- **Watch hardware:** Samsung Galaxy Watch 7 (model `SM-L315F`), Wear OS 5.1 / API 35
- **Backend:** Supabase project `oajcauenacyxwmosfcva` (the real Lovable web-app project)
- **Document generated:** 2026-05-31

---

## Table of Contents

1. [What this app is](#1-what-this-app-is)
2. [Tech stack](#2-tech-stack)
3. [Chronological log (verbatim prompts + actions)](#3-chronological-log)
4. [Key technical decisions](#4-key-technical-decisions)
5. [The two-Supabase-projects problem](#5-the-two-supabase-projects-problem)
6. [Hardware button limitation](#6-hardware-button-limitation)
7. [File-by-file change summary](#7-file-by-file-change-summary)
8. [Deploying to a physical Galaxy Watch 7](#8-deploying-to-a-physical-galaxy-watch-7)
9. [Wireless ADB troubleshooting](#9-wireless-adb-troubleshooting)
10. [Pending / future work](#10-pending--future-work)
11. [Commit history](#11-commit-history)

---

## 1. What this app is

A **standalone Wear OS app** that logs focus sessions from the wrist to the same Supabase
backend the Focus-TimeLog web app uses. It is a **companion** — quick Start / Pause / Stop
logging only. Analytics, history, and export stay in the web app. Every `time_blocks` row the
watch inserts appears in the web app instantly via Supabase Realtime. **No backend schema
changes were needed** — the watch is just another Supabase REST client subject to the same RLS
(`auth.uid() = user_id`).

**Why it exists:** pulling out a phone to start/stop a timer mid-work is friction; a glanceable
wrist app removes it.

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Language / UI | Kotlin + Jetpack Compose for Wear OS (`androidx.wear.compose:compose-material3`) |
| Supabase client | `io.github.jan-tennert.supabase` v3.0.0 (postgrest-kt + auth-kt) |
| HTTP engine | `io.ktor:ktor-client-okhttp` |
| Google sign-in | `androidx.credentials` (Credential Manager) + Google ID token |
| Local cache / queue | Room (categories cache + pending_blocks) |
| Settings | `DataStore<Preferences>` |
| Retry sync | WorkManager |
| Background timer | Foreground Service + Ongoing Activity |
| Token storage | EncryptedSharedPreferences |
| Ambient/dim | `AmbientLifecycleObserver` (`androidx.wear.ambient`) |
| Navigation | `SwipeDismissableNavHost` |
| 2-page home | `HorizontalPager` |
| App config | `applicationId = com.focuslog.wear`, minSdk 30, targetSdk 34, versionName 0.1.0 |

Secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_WEB_CLIENT_ID`) live in a git-ignored
`secrets.properties` and are baked into `BuildConfig` at compile time — **a clean build is
required whenever they change.**

---

## 3. Chronological log

> User prompts are **verbatim**. Each is followed by what was done in response.

### Phase A — Discovering secrets & repo setup

**Prompt:**
> "Why can't I find secrets.properties in the github?"

**Action:** Explained that `watch/secrets.properties` is **git-ignored** by design — it holds real
credentials (Supabase URL, anon key, Google Web client ID) and must never be committed.
A `secrets.defaults.properties` template is committed instead.

---

**Prompt:**
> "where is it in local?"

**Action:** Located it at the project root next to `watch/`. Confirmed it exists only locally and
maps to the same public values the web app exposes via `VITE_SUPABASE_URL` /
`VITE_SUPABASE_PUBLISHABLE_KEY`.

---

### Phase B — Project fix + major UI overhaul

**Prompt:**
> "Fix the project issue. Product Updates: The UI needs to be simple..." *(requested a major UI overhaul)*

**Action:** Diagnosed the wrong-Supabase-project bug (see §5) and planned the simplified UI: play-button
home screen, category pills, Settings page, ambient mode, default categories.

---

**Prompt:**
> "Directly the Focus Log home screen is appearing without login"

**Action:** Root cause — `AuthManager.restore()` used `importSession()`, which only stores a token
locally without network validation. A stale token from the old/empty project returned `true` and
bypassed the login screen. **Fix:** added `auth.refreshCurrentSession()` + verify `user?.id != null`
after import; on failure clear prefs and show the login screen.

---

**Prompt:**
> "Basic app seems to be working now. Make few product changes — single tap to 1st button to
> start/pause timer, also, double tap to take it to home screen of focus app. Add some default
> categories for all- Work, Study, Exercise, Break-Lunch, etc. Also, the dim everything to only
> show timer on screen. Bring most recent category pills on top"

**Action:** Implemented:
- Hardware button single-tap = start/pause, double-tap = home (later disabled — see §6)
- **Default category seeding** on first sign-in (Work, Study, Exercise, Personal, Break / Lunch,
  Social) with a one-time DataStore guard flag `default_categories_seeded`
- **Ambient mode** strips everything except the timer
- **MRU sort** — most-recently-used categories float to the top, via a DataStore string list
  `recent_category_ids` (max 10)

---

**Prompt:**
> "Add the feature to see the Total focussed duration neatly over the past 24 hours once we stop
> the timer/ stopwatch (and also neutral and distraction hours in smaller font) & tap it to take
> to summary pane that has focus, distraction & neutral time. Make sure to keep the UI clean and
> keep only timer once focus timer starts."

**Action:** Created a new **`DaySummaryScreen.kt`** shown after Stop: large green focus total,
smaller neutral/distraction totals, and a "📊 Full Summary" chip that opens the full
`SummaryScreen`. Swipe-back returns home. Wired a new `DAY_SUMMARY` route in `MainActivity`.

---

### Phase C — Testing & emulator bug fixes

**Prompt:**
> "Arighty. LEt's go and do it then starting with git pull command, give the step by step guide
> to test in emulator then.. Let's try on my actual Watch. Give detailed steps on how to do the
> setup on Watch."

**Action:** Provided git pull + emulator test steps + physical-watch setup guide.

---

**Prompt:**
> "I am testing in Emulator only for now. Issues- The Button is not working [details]. Home
> screen UI- aggregates not showing up. Home screen should show like- 'Focus Log: 6, 1, 0' where
> it means Focus Log: 6 hrs <Focus time over past 24 hours, in Green colour, bigger font>, 1 hr
> <Distracted time in red colour, smaller font>, 0 hrs <yellow, Neutral time>. Currently it's
> showing nothing."

**Action:** Two fixes:
- **Button unresponsive** — the single-tap used a 400ms coroutine `delay()` before firing,
  feeling broken. Changed to fire `toggleStartPause()` immediately on every tap.
- **Aggregates not showing** — `SummaryViewModel` was created but never passed to
  `HomeScreen`/`PlayPage`. Wired it through the call chain, added a stat bar below the "Focus Log"
  header (focus green/bold, distraction red, neutral amber; zero values hidden), and added
  `LaunchedEffect(Unit) { summaryVm.refresh() }`.

---

**Prompt:**
> "Just a minor Update- We need to add a small 'HH:MM' on the main screen when the timer is
> running, given it's a watch I would like to check what's the current time. Keep the font small
> and keep the UI very clean and tidy, especially when the focus timer is running. We need to
> optimise timer times so that it does not consume much energy while running it and we don't need
> to keep recharging the watch. Keep the priority on making the current features work for now."

**Action:**
- **Wall clock** — derived `HH:mm` from the existing `now` tick; shown small/muted above the
  category name (active screen) and dim below the timer (ambient).
- **Battery optimization** — variable tick rate: 1s when active, **15s in ambient mode** via
  `setAmbient()` on `TimerViewModel`, wired from `MainActivity` with
  `LaunchedEffect(isAmbient) { timerVm.setAmbient(isAmbient) }`.
- Changed the **Neutral color** from gray to **amber `0xFFF59E0B`** for visibility.

These shipped together in commit `eee0d24`.

---

### Phase D — Pointing at the right backend

**Prompt:**
> "Sure, all set? Should I run- cd /Users/nayanlal1909/StudioProjects/focus-timelog; git checkout
> claude/write-product-document-iKHKL; git pull origin claude/write-product-document-iKHKL"

**Action:** Confirmed yes. User pulled successfully (landed on `eee0d24`).

---

### Phase E — Hardware button limitation

**Prompt:**
> "I think the system's default is to take to Watch's home screen. We might need to change it in
> the Developer setting I guess as it is still taking me out of the app"

**Action:** Explained the platform constraint: **Wear OS reserves `KEYCODE_STEM_PRIMARY` at the
system level.** Apps cannot intercept it — the `onKeyDown` override is simply never called for the
primary button. There is **no developer setting** to change this. The Galaxy Watch 7 has only a
reserved Home button and a Back button.

---

**Prompt (user decision):**
> "You should have told me this before. Keep on-screen only: Just comment out the current sections
> of the code till future date if they enable it someday. Wear Tile is a good idea."

**Action:** Commented out the entire `onKeyDown` override in `MainActivity.kt` (preserved with a
`TODO` note explaining the limitation), commented out the now-unused `KeyEvent` import and
`lastStemTap` field, removed the unused `lifecycleScope` import. On-screen Play/Pause/Stop remain
the only controls. Committed as `0b03fa0` and pushed. **Wear Tile noted as future work.**

---

### Phase F — Deploying to the physical watch

**Prompt:**
> "Let's try it out on my actual watch now"

**Action:** Produced a deployment plan: wireless ADB pairing (Watch 7 has no USB data port),
clean build, install, round-trip verification.

---

**Prompt (terminal output):**
> ```
> adb pair 192.168.1.12:43265 / adb connect / adb devices
> zsh: command not found: adb
> ```
> "There is also a wifi pairing code in watch- 538950"

**Action:** `adb` not on PATH. Fixed with
`export PATH="$HOME/Library/Android/sdk/platform-tools:$PATH"`. Guided pairing with code 538950.

---

**Prompt:**
> Pairing succeeded on `192.168.1.12:33103`; `adb devices` showed only `emulator-5554`.

**Action:** Explained pairing ≠ connecting; needed the **connect** port from the main Wireless
debugging screen (different from the pairing port).

---

**Prompt:**
> `adb connect 192.168.1.12:43265` → `connected`; `adb devices` showed the watch +
> `adb-RZAX601H90Y...` + emulator. "Okay What's next?"

**Action:** Discovered **no `gradlew` wrapper** is committed (only the `gradle/` config dir), so
CLI `./gradlew` fails. Directed to build via **Android Studio** (has its own Gradle).

---

**Prompt:**
> "This was the error message- ... zsh: no such file or directory: ./gradlew"

**Action:** Confirmed the missing wrapper; reiterated using the Android Studio **▶ Run** button.

---

**Prompt:**
> Screenshot: "Install successfully finished" + "What's next? Nothing else is appearing here
> except emulator"

**Action:** The install went to the **emulator** (still selected in the device dropdown). Directed
to select the physical watch `samsung-sm_l315f` in the dropdown.

---

**Prompt:**
> "Somehow the sm-l315f is not appearing" *(×3)*

**Action:** Connection Assistant detected it (`samsung-sm_l315f-192.168.1.12:43265`) but the run
dropdown didn't list it because the wireless ADB connection kept dropping. Suggested reconnect +
"Select Multiple Devices…" + "Rescan devices."

---

**Prompt:**
> "We might need to reconnect"

**Action:** Provided reconnect steps + "Stay awake" developer setting; explained the port rotates.

---

**Prompt:**
> Screenshot: ports 43945 / 36855 / 40961 / 46835 all "Connection refused"; Connection Assistant
> shows "Device is currently in offline state." "Not getting connected somehow"

**Action:** Explained the port **rotates** each cycle — stale ports get refused. Gave a clean reset:
`adb kill-server && adb start-server`, toggle Wireless debugging OFF/ON, read the **current** port,
reconnect (re-pair if offline persists).

---

**Prompt:**
> "This also is not getting connected somehow" *(after trying Android Studio's Pair Using Wi-Fi)*

**Action:** Identified the highest-yield root causes and asked diagnostic questions.

---

**Prompt (answers):**
> Watch is **Not on charger**; watch is **Paired to phone** via Bluetooth.

**Action:** Diagnosed:
1. **Not on charger** → Watch 7 turns Wi-Fi off the instant the screen sleeps (the main cause of
   the repeated drops and rotating ports).
2. **Bluetooth-tethered to phone** → watch routes through the phone and keeps its own Wi-Fi
   dormant.
Fix: put the watch on its charger (forces Wi-Fi to stay on), enable "Stay awake," confirm the
watch's own Wi-Fi is on the same network, then re-pair/connect.

---

**Prompt:**
> "It's not happening now, I think I should restart the Wear OS App Emulator and all as it was
> getting connected earlier"

**Action:** Agreed — the emulator is reliable for now. Directed to select the emulator in the
device dropdown, start it via Device Manager if stopped, and Run. Physical-watch deployment
deferred until the watch is on its charger with time for a fresh pairing.

---

**Prompt:**
> "Create a Document of What all we did one by one so that I can search it in a document and give
> me a Document for reference. Do not miss any Prompt (keep it verbatim). Give a downloadable
> document"

**Action:** Generated **this document**.

---

## 4. Key technical decisions

- **Standalone watch + one-time sign-in** (no phone companion app). The watch authenticates itself
  and behaves like any other Supabase client.
- **Zero backend/schema changes** — the single biggest factor keeping the project tractable.
- **Battery via variable tick rate** — 1s active, 15s ambient.
- **MRU categories via DataStore** string list — no Room migration needed.
- **Default category seeding** guarded by a one-time DataStore flag so it won't re-seed if the user
  later deletes categories.
- **Session validation on restore** — refresh the session over the network so stale tokens can't
  bypass login.

---

## 5. The two-Supabase-projects problem

There were **two** Supabase projects, and the watch had been pointing at the wrong one:

| Project | Role | Evidence |
|---|---|---|
| `oajcauenacyxwmosfcva` | **REAL** — web app + all categories + real data | Hardcoded in `.env`, `supabase/config.toml`, migrations. Anon key issued 2026-05-14. |
| `maueewmudzivsfxsybvi` | **EMPTY** — accidentally created during debugging | Anon key issued 2026-05-30. Only a test user, no schema, no categories. |

This explained why login "worked" but no categories ever loaded — the watch and web app were on
different databases. **Fix:** point `secrets.properties` at `oajcauenacyxwmosfcva` and do a clean
build. (Optional cleanup: delete the stray empty project later.)

---

## 6. Hardware button limitation

**Wear OS reserves `KEYCODE_STEM_PRIMARY` at the system level.** Apps cannot intercept it — the
primary side button always takes the user to the watch home screen, and `onKeyDown` is never
called for it. There is no developer setting to override this. The Galaxy Watch 7 physically has
only a reserved Home button and a Back button.

**Decision:** comment out the `onKeyDown` handling (preserved in comments with a `TODO` for future
re-enablement), keep **on-screen Play/Pause/Stop** as the only controls. A **Wear Tile** for
one-tap start/stop is noted as a good future addition.

---

## 7. File-by-file change summary

| File | Change |
|---|---|
| `presentation/MainActivity.kt` | Ambient→ViewModel wiring; `DAY_SUMMARY` route; stop → day summary; `onKeyDown` hardware-button block **commented out** (platform limitation) |
| `presentation/CategoryPickerScreen.kt` | `HomeScreen` with `HorizontalPager` (Play + Settings pages); MRU sort; today's stat bar wired to `SummaryViewModel` |
| `presentation/ActiveTimerScreen.kt` | Wall-clock `HH:mm`; ambient = timer-only + dim clock |
| `presentation/DaySummaryScreen.kt` | **New** — post-stop day summary card → full summary |
| `presentation/Theme.kt` | Neutral color gray → amber `0xFFF59E0B` |
| `viewmodel/TimerViewModel.kt` | Settings-driven flows; default-category seeding; MRU push; `setAmbient()` + variable tick rate; `addCategory` refresh fix |
| `data/WatchSettings.kt` | DataStore keys: pomodoro work/break, sleep, last category, `default_categories_seeded`, `recent_category_ids` |
| `data/SupabaseRepository.kt` | `seedDefaultCategories()`; `addCategory()` with optional order |
| `auth/AuthManager.kt` | `restore()` validates token via `refreshCurrentSession()` to prevent login bypass |

---

## 8. Deploying to a physical Galaxy Watch 7

The Watch 7 has **no USB data port** — deployment is over **wireless ADB** on the same Wi-Fi.

1. **Pull the branch:**
   ```bash
   cd /Users/nayanlal1909/StudioProjects/focus-timelog
   git checkout claude/write-product-document-iKHKL
   git pull origin claude/write-product-document-iKHKL
   ```
   Confirm `secrets.properties` exists at the project root and points at
   `oajcauenacyxwmosfcva`.

2. **Watch → developer + wireless debugging:**
   - Settings → About watch → Software → tap **Software version** 7× → developer mode
   - Settings → Developer options → **ADB debugging** ON
   - **Wireless debugging** ON → **Pair new device** (shows IP:port + 6-digit code)
   - **Stay awake** ON (and put the watch on its **charger** — see §9)

3. **Pair + connect (PATH first):**
   ```bash
   export PATH="$HOME/Library/Android/sdk/platform-tools:$PATH"
   adb pair 192.168.1.x:PAIRPORT        # enter the 6-digit code
   adb connect 192.168.1.x:CONNECTPORT  # port from the MAIN wireless-debugging screen
   adb devices                          # watch should show as "device"
   ```

4. **Build + install via Android Studio** (no `gradlew` wrapper is committed, so CLI gradle won't
   work):
   - Device dropdown → select **`samsung-sm_l315f`** (the watch, not the emulator)
   - **Build → Clean Project** (secrets are baked into `BuildConfig`)
   - Click **▶ Run**

5. **Verify on-device:** sign in → categories load → start a timer (wall clock + counting) →
   ambient dims to timer-only → stop → day summary → block appears live in the web app.

---

## 9. Wireless ADB troubleshooting

Symptoms seen this session: `command not found: adb`, connection refused on rotating ports, device
stuck "offline," watch missing from the run dropdown.

**Root causes & fixes (in priority order):**

1. **adb not on PATH** → `export PATH="$HOME/Library/Android/sdk/platform-tools:$PATH"`
2. **Watch not on charger (the #1 cause)** → Watch 7 turns Wi-Fi off the moment the screen sleeps.
   **Put it on the charger** so Wi-Fi stays on permanently. Enable Developer options → **Stay
   awake**.
3. **Bluetooth-tethered to phone** → the watch keeps its own Wi-Fi dormant. Ensure the watch's
   **own Wi-Fi** is connected to the same network as the Mac.
4. **Port rotates each cycle** → only the port on the watch's **main Wireless debugging screen**
   works, and it changes; always read it fresh right before `adb connect`. Stale ports →
   "Connection refused."
5. **Stuck "offline"** → full reset: `adb kill-server && adb start-server`, toggle Wireless
   debugging OFF/ON, re-pair, then connect.
6. **Same-network check** → both must be on the **identical** Wi-Fi SSID (not a 2.4/5GHz variant,
   not a hotspot). Watch out for router **client/AP isolation** on guest networks.

**Fallback:** the **emulator** (NayanW7-Wear OS Large Round) is reliable for functional testing —
no wireless dropouts. Use it to validate behavior; deploy to the physical watch when it's charging
and you have a few uninterrupted minutes to pair fresh.

---

## 10. Pending / future work

- **Physical-watch deployment** — deferred until the watch is on its charger for a stable wireless
  ADB session.
- **Wear Tile** — one-tap "Start last category" / "Stop" glanceable surface (user called this "a
  good idea").
- **Gradle wrapper** — not committed; either add it (`gradle wrapper`) or keep building via Android
  Studio.
- **Cleanup** — optionally delete the stray empty Supabase project `maueewmudzivsfxsybvi`.
- **Local Android Studio version-bump files** (`watch/build.gradle.kts`, `gradle.properties`,
  wrapper props) — decide whether to commit.

---

## 11. Commit history (this branch)

| Commit | Summary |
|---|---|
| `eee0d24` | Button responsiveness (immediate toggle), home-screen stat bar (SummaryViewModel wired), wall-clock HH:mm on timer, battery optimization (15s ambient tick) |
| `0b03fa0` | Comment out hardware-button handling — Wear OS platform limitation (KEYCODE_STEM_PRIMARY reserved); on-screen controls only |

Branch: `claude/write-product-document-iKHKL` — all work pushed to `origin`.

---

*End of document.*
