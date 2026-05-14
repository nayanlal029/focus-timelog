## Goal

Move FocusLog from local-only storage to cloud-synced storage with login, so the same data is available on phone, tablet, and desktop. Add multi-select + merge for sessions so you can clean up Chrome-imported segments whose actual on-page time was longer than the JSON suggests.

## 1. Backend (Lovable Cloud)

Enable Lovable Cloud and create three tables, all with strict RLS scoped to `auth.uid()`:

- `categories` — id, user_id, name, type (focus/distraction/neutral), order, builtin
- `time_blocks` — id, user_id, category_id, category_name, type, start_ms, end_ms, note, link, is_break
- (auth users come for free)

Index `time_blocks(user_id, start_ms desc)` for fast range queries on Dashboard / History.

## 2. Auth

Sign-in: **email/password + Google** (via Lovable broker).

- New `/login` route with email+password form and "Sign in with Google" button
- Pathless `_authenticated` layout protects every existing app route (Timer, Dashboard, History, Settings)
- Sign-out lives in Settings

## 3. Sync layer (performance-conscious)

Refactor `FocusLogProvider` so it loads from the DB once after login and keeps an in-memory cache. Reads always hit memory (no perf regression). Writes are optimistic: update memory immediately, then persist to DB in background.

- On login: hydrate categories + time_blocks for the user
- On any add/update/delete: optimistic local update + debounced background upsert/delete
- One realtime subscription on `time_blocks` so other devices see new sessions live (without re-querying)
- Local cache (localStorage) acts as offline buffer; pending writes flush when reconnected

## 4. Chrome import — always add as new

Drop dedup logic per your answer. Each imported file just appends new segments to the DB. Importing history from a second Google account merges naturally (they're all just rows tagged with the same user_id).

## 5. Multi-select + Merge sessions (History)

In History:

- Add a "Select" toggle that turns each row into a checkbox row
- Selected count appears in a sticky action bar with **Merge** and **Delete** buttons
- **Merge** opens a dialog with: category dropdown (pre-filled with most-common selected category), optional note, then creates one new block spanning `min(start) → max(end)` and deletes the originals
- All changes go through the same sync layer → instantly reflected on other devices

This directly addresses Chrome segments where you actually spent longer reading a page than visit timestamps suggest: select the related fragments and merge them into one accurate session.

## Technical notes

- **Stack**: Lovable Cloud (Supabase under the hood), TanStack Start `_authenticated` layout, `createServerFn` for auth-protected mutations, `requireSupabaseAuth` middleware, browser client only for the realtime subscription
- **Migration**: First-login migration copies any existing localStorage categories/blocks into the DB so you don't lose current data
- **Schema**: `start`/`end` stored as `bigint` (epoch ms) to match the existing `TimeBlock` shape exactly

## Out of scope this round

- Improving the Chrome classifier rules (you confirmed the real fix is user-driven merging, not better auto-classification)
- Sharing data across user accounts
