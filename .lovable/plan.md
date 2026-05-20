## Scope

Six additive feature updates plus a documented bug fix. No schema changes — everything fits the existing `categories`/`time_blocks` tables and current local-storage seed flow.

---

## 1. Change Log

- New route `src/routes/changelog.tsx` (path `/changelog`).
- Content sourced from a single in-file array `CHANGELOG: { date: string; title: string; items: string[] }[]`, newest first.
- Render: timeline-style list — date chip, title, bullet items, semantic tokens only.
- Add nav entry in `AppShell` (and a link in Settings footer).
- Seed entries: prior milestones (auth + cloud sync, sample categories, Chrome import, multi-select) and the new entries shipped in this turn.

## 2. Category Column (History)

- Target: In the main screen apart from the Category chips add search button to bring up the relevant category according to what user types.
- Additional target: the History screen's per-day Timeline / block list (the "Category" column).
- Add a search `Input` above the list. State is local to `history.tsx` (`query`, debounced via `useDeferredValue`).
- Filter: `block.categoryName.toLowerCase().includes(query)`. Applied AFTER date-range filter, BEFORE rendering Timeline + totals for the selected day.
- Clear (×) button inside the input. Highlight matched substring is out of scope — keep simple.

## 3. Dashboard Data Bug — Root Cause + Fix

**Bug**: `src/routes/dashboard.tsx` (and `history.tsx`) filters with
`blocks.filter(b => b.start >= range.start && b.start <= range.end)` and then sums full `end - start`.

Three concrete defects:

1. Blocks **starting before** `range.start` but ending inside the range are **dropped entirely** (e.g. an activity that began before midnight on Day 1 is invisible on the "Today" view).
2. Blocks **starting inside** the range but **ending after** `range.end` are **counted in full**, inflating totals.
3. Per-day bucketing keys by `dayKey(b.start)`, so an activity spanning midnight is fully attributed to the start day even when the range crosses that day.

**Fix** — clamp every block to the active window (and to the day window when bucketing):

```ts
function overlapMs(bStart: number, bEnd: number, rStart: number, rEnd: number) {
  const s = Math.max(bStart, rStart);
  const e = Math.min(bEnd, rEnd);
  return e > s ? e - s : 0;
}
```

- Replace the `filtered` array with a derived list of `{ block, clippedMs }` where `clippedMs = overlapMs(b.start, b.end, range.start, range.end)` and keep only `clippedMs > 0`.
- `sumByType` becomes a reducer over `clippedMs`.
- For per-day bars, compute `dayMs = overlapMs(b.start, b.end, dayStart, dayEnd)` for each (block, day) pair instead of bucketing on start-day only.
- `topByCategory` also uses `clippedMs`.
- Apply the same `overlapMs` helper to `history.tsx` totals so both screens agree. Extract to `src/lib/focuslog/format.ts` (or new `aggregate.ts`).

This is a pure presentation/aggregation fix — no DB / state changes.

## 4. Guest Mode (skip login)

- `LoginScreen` gets a tertiary link: **"Continue without signing in"**.
- Clicking it sets `localStorage["focuslog.guest"] = "1"` and calls a new `setGuest(true)` exposed by `AuthProvider`.
- `AuthGate` (in `__root.tsx`) treats `guest === true` as authorized and renders the app.
- `FocusLogProvider` already loads `storage.loadCategories/loadBlocks/loadActive` locally — guest mode just skips the Supabase hydrate + realtime subscription path (gate the `user`-effect with `if (!user && !guest) return`).
- In guest mode, all DB write helpers no-op (already guarded by `userIdRef.current` being null), so categories/blocks live only in `localStorage`. The existing `storage.saveBlocks/saveCategories` are persisted by adding two effects:
`useEffect(() => storage.saveCategories(categories), [categories]);` and same for blocks — gated on `!user` so we don't double-write for signed-in users.
- Settings → Account section: when in guest mode, show "Guest — data stays on this device" and a **"Sign in to sync"** button (clears guest flag, re-renders LoginScreen). Export to Excel still works.

## 5. Pomodoro Mode (Timer screen)

- New section in `TodayScreen` above the Timeline: **"Pomodoro"** toggle.
- Local state (persisted to `localStorage["focuslog.pomodoro"]`):
  - `enabled: boolean`
  - `workMin: number` (default 25)
  - `breakMin: number` (default 5)
- UI: small card with toggle + two number inputs (min 1, max 120). Settings page also gets a mirrored config under a new "Pomodoro" section.
- Behavior:
  - When `enabled` and an activity is running (i.e. `active && active.runningSince`), a `useEffect` schedules a `setTimeout` at `workMin*60_000` from `active.runningSince`. On fire: vibrate + play short beep (WebAudio oscillator, no asset needed) + toast "Time for a break".
  - When paused (i.e. `active.breakStartedAt != null`), schedule a `breakMin*60_000` timer from `breakStartedAt`. On fire: stronger haptic + beep + toast "Break over — back to focus".
  - All timers cleared on unmount, stop, or config change.
- Keep "simple": no auto-pause / auto-resume. Just notify.

## 6. Distraction Pause Alerts

- Trigger: whenever the active timer is **paused** (`active.breakStartedAt != null`), treat it as "distraction / break time" and fire escalating [small] alerts at **5, 10, 15, 30, 60, 90 min** (then every 30 min).
- Implementation: in `TodayScreen` (or a small `usePauseAlerts(active)` hook), maintain a `useEffect` keyed on `active?.breakStartedAt`. Each fire schedules the next `setTimeout` based on elapsed pause time and the next milestone.
- Alert = vibrate + WebAudio beep + toast ("You've been paused for X min").
- Settings → new "Alerts" section:
  - `Pause alerts` switch (default ON)
  - Stored in `localStorage["focuslog.alerts.pause"]`
- Hook reads the flag at fire time; skips if disabled. No alerts when timer is fully stopped (no `active`) or actively running.

## 7. Product Doc Update

After the above ships, edit `PRODUCT_DOCUMENT.md`:

- Bump version to **1.1**.
- Add subsections under §6: 6.12 Change Log, 6.13 Pomodoro Mode, 6.14 Pause Alerts, 6.15 Guest Mode. Add "Search in Category column" to 6.5 History.
- Update §6.4 Dashboard with the clamped-overlap aggregation rule (calling out the previous bug as fixed).
- Append a "Changelog (in-app)" reference under §11.

---

## Technical notes

- No SQL migrations. No new dependencies (WebAudio + native `navigator.vibrate` cover sounds/haptics).
- All new state is React + `localStorage`. No `process.env`, no server functions.
- Tokens only — no hardcoded colors. Reuse `bg-focus`, `bg-distraction`, `bg-accent`.
- Files touched (new): `src/routes/changelog.tsx`, `src/lib/focuslog/aggregate.ts`, `src/lib/focuslog/usePauseAlerts.ts`, `src/lib/focuslog/usePomodoro.ts`, `src/lib/focuslog/sound.ts`.
- Files edited: `src/routes/dashboard.tsx`, `src/routes/history.tsx`, `src/routes/settings.tsx`, `src/routes/__root.tsx`, `src/lib/auth-context.tsx`, `src/lib/focuslog/context.tsx` (guest gate + local persistence effects), `src/components/auth/LoginScreen.tsx`, `src/components/focuslog/TodayScreen.tsx`, `src/components/focuslog/AppShell.tsx`, `PRODUCT_DOCUMENT.md`.