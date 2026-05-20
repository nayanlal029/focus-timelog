# Focus-TimeLog — Product Document

**Version:** 1.0 (Current)
**Document Type:** Product Requirements & Feature Specification
**Status:** Live / Production

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Target Users & Use Cases](#2-target-users--use-cases)
3. [Core Value Proposition](#3-core-value-proposition)
4. [Technology Stack](#4-technology-stack)
5. [Data Model](#5-data-model)
6. [Feature Specifications](#6-feature-specifications)
   - 6.1 [Authentication](#61-authentication)
   - 6.2 [Timer (Today Screen)](#62-timer-today-screen)
   - 6.3 [Focus Mode](#63-focus-mode)
   - 6.4 [Dashboard & Analytics](#64-dashboard--analytics)
   - 6.5 [History View](#65-history-view)
   - 6.6 [Settings & Customization](#66-settings--customization)
   - 6.7 [Category Management](#67-category-management)
   - 6.8 [Chrome History Import](#68-chrome-history-import)
   - 6.9 [Excel Export](#69-excel-export)
   - 6.10 [Multi-Select & Bulk Actions](#610-multi-select--bulk-actions)
   - 6.11 [Cross-Device Real-Time Sync](#611-cross-device-real-time-sync)
7. [UX & Design Principles](#7-ux--design-principles)
8. [State Management Architecture](#8-state-management-architecture)
9. [Security & Data Privacy](#9-security--data-privacy)
10. [Metrics & Success Criteria](#10-metrics--success-criteria)
11. [Known Limitations & Future Opportunities](#11-known-limitations--future-opportunities)

---

## 1. Product Overview

**Focus-TimeLlog** (internally "FocusLogNL") is a mobile-first, cloud-synced time-tracking application designed to help individuals understand where their time actually goes — distinguishing productive focus time from distractions and neutral activity in a continuous, timeline-based view.

Unlike conventional time-trackers that require rigid project/task hierarchies, Focus-TimeLlog treats time as a flowing stream: every moment belongs to a category, and switching activities is as fast as tapping a chip. The result is an honest, ground-truth record of how time is spent throughout the day.

**Core loop:**

> Start timer → work/get distracted → stop → review timeline → improve tomorrow

---

## 2. Target Users & Use Cases

### Primary User: The Self-Improving Individual

- **Knowledge workers** (developers, designers, writers) who want to reduce unintentional distraction time
- **Students** tracking study vs. social media vs. breaks
- **Remote workers** who lack a structured office environment and need self-accountability

### Secondary User: The Retrospective Analyst

- Someone who doesn't track in real time but wants to reconstruct their digital day by importing Chrome history

### Jobs to Be Done

| Job | How Focus-TimeLlog Solves It |
|-----|------------------------------|
| "I want to know how much I actually focused today" | Live timer with focus/distraction labeling; Dashboard totals card |
| "I keep getting distracted and want to see the pattern" | Timeline + Gantt chart with color-coded distraction blocks |
| "I don't always remember to log in real time" | Add Past Activity; Chrome history import |
| "I want to review my week and plan better" | 7-day dashboard with per-day bar chart + top categories |
| "I need the data in a spreadsheet for further analysis" | Excel export with date/time range filter |
| "I switch between phone and laptop during the day" | Real-time Supabase sync across all devices |

---

## 3. Core Value Proposition

**Focus-TimeLlog turns invisible time into visible insight.**

- **Speed**: Logging an activity takes one tap — no project selection trees, no text entry required.
- **Honesty**: The Focus / Distraction / Neutral classification makes the data emotionally legible. You can see at a glance if today was a "focus day" or a "distraction day."
- **Continuity**: The timeline model means every minute is accounted for, not just the good ones.
- **Flexibility**: Works as a real-time timer, a retrospective logger, or a Chrome-history reconstructor.
- **Ownership**: Full data export to Excel; delete-all option; no vendor lock-in.

---

## 4. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 19.2 + TypeScript 5.8 via TanStack Start |
| Routing | TanStack React Router 1.168 |
| Data fetching | TanStack React Query 5.83 |
| Styling | Tailwind CSS 4.2 with CSS custom properties |
| UI primitives | 40+ Radix UI accessible components |
| Icons | Lucide React |
| Backend / DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + Google OAuth via Lovable broker) |
| Real-time | Supabase Realtime (postgres_changes) |
| Build tool | Vite 7.3 + Cloudflare Pages plugin |
| Hosting | Cloudflare Pages (via wrangler.jsonc) |
| Export | ExcelJS |
| Forms | react-hook-form + Zod |
| Notifications | Sonner (toast system) |

---

## 5. Data Model

All data is stored in Supabase with row-level security (RLS). Every row is scoped to the authenticated `user_id` — users can only read and write their own data.

### 5.1 `categories` Table

Represents the user's taxonomy of activities.

| Column | Type | Description |
|--------|------|-------------|
| `id` | string (UUID) | Primary key |
| `user_id` | string | Owner; FK to `auth.users` |
| `name` | string | Display name (e.g., "Work", "Social-Insta") |
| `type` | enum | `"focus"` \| `"distraction"` \| `"neutral"` |
| `order` | number | Manual sort order |
| `builtin` | boolean | True for system-seeded defaults |
| `created_at` | timestamp | |
| `updated_at` | timestamp | Auto-updated on change |

**Default built-in categories (seeded on first login):**

| Name | Type |
|------|------|
| Work | focus |
| Work-Meet | focus |
| Study | focus |
| Study-Product | focus |
| Gym | focus |
| Podcast | neutral |
| Social-Insta | distraction |
| Break | neutral |

### 5.2 `time_blocks` Table

Each row is a logged activity segment.

| Column | Type | Description |
|--------|------|-------------|
| `id` | string (UUID) | Primary key |
| `user_id` | string | Owner; FK to `auth.users` |
| `category_id` | string | FK to `categories.id` |
| `category_name` | string | Snapshot of name at log time (survives category renames) |
| `type` | enum | `"focus"` \| `"distraction"` \| `"neutral"` |
| `start_ms` | bigint | Unix epoch milliseconds (start of block) |
| `end_ms` | bigint | Unix epoch milliseconds (end of block) |
| `note` | text | Optional freeform note |
| `link` | text | URL (populated from Chrome imports) |
| `is_break` | boolean | True for auto-generated break segments |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Index:** `(user_id, start_ms DESC)` — supports fast range queries for dashboard and history views.

### 5.3 Local State (Ephemeral)

Maintained in React context; not persisted to DB except where noted.

| Key | Storage | Description |
|-----|---------|-------------|
| Active timer state | localStorage | Survives tab reload; synced to DB on stop |
| Theme preference | localStorage | `"dark"` \| `"light"` |
| Filter state (dates) | localStorage | Last-used date range filters |

---

## 6. Feature Specifications

### 6.1 Authentication

**Entry point:** `/` redirects to LoginScreen if no session exists (via `AuthGate` in root layout).

#### Sign-Up / Sign-In Methods

| Method | Flow |
|--------|------|
| Email + Password | Standard Supabase Auth email/password |
| Google OAuth | Delegated through Lovable broker; redirects back to app |

#### Session Handling

- Sessions are persisted by Supabase Auth (refresh tokens stored in browser storage).
- `AuthContext` listens to `onAuthStateChange` and exposes `{ user, session, ready, signOut }` to the entire app.
- On first login (empty DB), the app migrates any data found in localStorage (from a previous guest session) into the user's Supabase account.

#### Sign-Out

- Available from Settings tab.
- Clears session and returns user to LoginScreen.

---

### 6.2 Timer (Today Screen)

**Route:** `/`

The primary daily driver. Designed for minimal friction: one tap to start, one tap to stop.

#### Layout

```
┌──────────────────────────────┐
│  [TODAY'S DATE]               │
│                               │
│  [Category chips row]         │
│  ← scroll → (focus first)    │
│                               │
│  ████████████████████████     │
│       ACTIVE TIMER HH:MM:SS  │
│                               │
│  [PAUSE]   [STOP]             │  (when active)
│  [START]                      │  (when idle)
│                               │
│  [Add past activity]          │
│                               │
│  ─── Today's Timeline ───     │
│  • 09:00–10:30  Work  1h 30m  │
│  • 10:30–10:45  Break 15m     │
│  • ...                        │
│                               │
│  [Load more]                  │
└──────────────────────────────┘
```

#### Timer States

| State | UI | Available Actions |
|-------|----|-------------------|
| **Idle** | Duration = 0, no active category | Select category → Start |
| **Running** | Timer counting up, category highlighted | Pause, Stop, switch to Focus Mode |
| **Paused** | Timer frozen, break block accumulating | Resume, Stop |

#### Category Chip Row

- Horizontally scrollable row of all user categories.
- Focus-type categories surfaced first (by type, then by `order`).
- Tapping a chip when idle: sets that category as the next activity.
- Tapping a chip when running: confirms switching category (stops current, starts new).
- Selected chip is visually highlighted with a colored ring.

#### Break Tracking (Automatic)

When a running activity is paused:
1. Current activity block is closed at the pause timestamp.
2. A `Break` category block begins automatically.
3. On Resume: Break block is closed; the original activity restarts as a new block.
4. On Stop: Break block is closed; no new activity starts.

This produces an accurate, gap-free timeline without any manual break logging.

#### Add Past Activity

Opens a bottom sheet allowing users to backfill an activity they forgot to log:
- Fields: Category, Start Date/Time, End Date/Time, Note (optional)
- Validates that end is after start; that the block is in the past
- On save: inserts block directly into DB + updates local state

#### Today's Timeline

Displays all `time_blocks` for the current calendar day in reverse-chronological order.
- Paginated at 20 items; "Load more" button appends next 20.
- Each entry shows: category name, colored type badge, start–end clock times, duration.
- Multi-select mode (see §6.10) available for bulk delete.

---

### 6.3 Focus Mode

**Trigger:** Full-screen button on Today Screen when timer is running.

A distraction-eliminating overlay that shows only the essential: what you're working on and for how long.

#### Behavior

- Enters a true fullscreen view (white/dark background, large typography).
- UI auto-hides after **3.5 seconds** of inactivity to minimize temptation.
- Tap anywhere to reveal controls (Pause, Stop, exit Focus Mode).
- Controls auto-hide again after 3.5 seconds.
- Haptic feedback on tap (vibrate API).
- Timer updates every 250 ms for smooth display.

#### Visual Design

```
┌──────────────────────────────┐
│                               │
│                               │
│         Work                  │  (category name, large)
│       01:23:45                │  (HH:MM:SS, extra-large monospace)
│                               │
│   [Pause]        [Stop]       │  (auto-hiding)
│                               │
└──────────────────────────────┘
```

---

### 6.4 Dashboard & Analytics

**Route:** `/dashboard`

Aggregates logged time into meaningful summaries over a configurable date range.

#### Filter Panel

- **Presets:** Today | Last 7 days | Last 30 days | Last 90 days | All time | Custom
- **Custom range:** Date pickers with optional time-of-day start/end
- Filter state is persisted in localStorage and shared with the History view

#### Summary Cards

| Card | Metric |
|------|--------|
| Focus Time | Total ms of `type = "focus"` blocks in range |
| Distraction Time | Total ms of `type = "distraction"` blocks |
| Neutral Time | Total ms of `type = "neutral"` blocks |

#### Mini Stats Row

| Stat | Description |
|------|-------------|
| Sessions | Total number of non-break time blocks |
| Focus % | Focus ms / (Focus + Distraction ms) × 100 |
| Avg Session | Total time / number of sessions |

#### Per-Day Bar Chart (Range Breakdown)

- Stacked bar chart: one bar per calendar day in the selected range
- Bottom segment: Distraction (red)
- Top segment: Focus (blue)
- Neutral is excluded to keep the signal clean
- X-axis: abbreviated date labels
- Y-axis: hours

#### Top Categories

Two ranked lists, each showing the top 5:

| List | Sorted By |
|------|-----------|
| Top Focus Categories | Total focus ms, descending |
| Top Distraction Categories | Total distraction ms, descending |

Each entry displays: category name, total duration, visual bar proportional to the #1 entry.

---

### 6.5 History View

**Route:** `/history`

A retrospective view combining a calendar overview with drill-down into individual days.

#### Calendar Panel

- Month grid (Sunday–Saturday)
- Each day cell shows a small **focus/distraction ratio bar** — a two-tone mini-bar filled proportionally to the day's logged time
- Days with no data are visually muted
- Tapping a day selects it for the detail view
- Previous / Next month navigation arrows

#### Day Detail Panel

Shows detailed breakdown for the selected day:

1. **Hour Gantt Chart (`HourGantt`):** A 24-column timeline where each column represents one hour. Blocks are rendered as colored segments spanning their actual start/end time within the hour grid. Color-coded by type.

2. **Activity Timeline:** Same component as Today Screen's timeline, but filtered to the selected day. Shows all blocks with timestamps, durations, and category names.

#### Interaction

- Filter Panel also applies to History — adjusting the filter restricts which days show data in the calendar and which blocks appear in the day view.
- A "View All" modal can show all filtered entries with a summary.

---

### 6.6 Settings & Customization

**Route:** `/settings`

Central control panel for personalizing the app and managing data.

#### Account Section

- Displays signed-in email address.
- **Sign Out** button.

#### Theme Toggle

- Switch between **Dark mode** (default) and **Light mode**.
- Preference stored in localStorage; applied globally via CSS class on `<html>`.

#### Data Operations

| Action | Behavior |
|--------|----------|
| **Export to Excel** | Opens date-range preset picker; generates `.xlsx` download |
| **Import Chrome History** | Opens ChromeImportSheet (see §6.8) |
| **Delete All Data** | Two-step confirmation dialog; irreversibly removes all `time_blocks` and `categories` for the user |

---

### 6.7 Category Management

**Location:** Settings → Categories section

Categories are the primary taxonomy of Focus-TimeLlog. Users maintain a personal library of named activities, each typed as Focus, Distraction, or Neutral.

#### Create Category

Tapping "Add Category" opens `CategoryDialog`:
- **Name field:** Free text (e.g., "Deep Work", "YouTube")
- **Type selector:** Focus / Distraction / Neutral (color-coded radio buttons)
- On save: appended to end of list; immediately synced to Supabase

#### Edit Category

Long-press or edit icon on any category row opens the same dialog pre-filled.
- Name and type can be changed; changes cascade only to new blocks (historical blocks retain the snapshot name from `category_name` column)

#### Delete Category

Trash icon on category row; confirmation dialog shown.
- Soft behavior: blocks that referenced the category retain their `category_name` snapshot.

#### Reorder Categories

Up/down arrow buttons on each category row.
- Order determines the sort order in the chip row on the Timer screen.
- Built-in categories can be reordered; cannot be deleted.

#### Type Color Coding

| Type | Chip/Badge Color | Semantic |
|------|-----------------|----------|
| Focus | Blue | Productive, intentional work |
| Distraction | Red/Orange | Unintentional, should be minimized |
| Neutral | Gray | Neither good nor bad (breaks, admin) |

---

### 6.8 Chrome History Import

**Location:** Settings → Import Chrome History

Allows users to reconstruct their digital activity from browser history — useful for backfilling days when they forgot to use the timer, or for getting a complete picture of their browsing time.

#### Supported Input Formats

| Format | How to Export |
|--------|--------------|
| **Google Takeout** | Google Account → Data & Privacy → Download data → Chrome → `BrowserHistory.json` |
| **Quick Chrome History Export** | Browser extension that exports visits as JSON |

#### Import Pipeline

1. **Parse JSON:** Extract visit entries (URL + timestamp).
2. **Classify URLs:** Each hostname is matched against 40+ hardcoded rules to determine `(name, type)`. Examples:

   | Domain | Mapped Category | Type |
   |--------|----------------|------|
   | `github.com` | Work | focus |
   | `stackoverflow.com` | Work | focus |
   | `youtube.com` | YouTube | distraction |
   | `instagram.com` | Social-Insta | distraction |
   | `notion.so` | Study-Product | focus |
   | `docs.google.com` | Work | focus |
   | *(no match)* | Browsing | distraction |

3. **Segment visits:** Groups consecutive page visits by category into contiguous blocks.
   - Gap threshold is auto-calculated: `clamp(4 × median_inter_visit_gap, 2 min, 15 min)`.
   - A new segment starts when the gap exceeds the threshold or the category changes.

4. **Create missing categories:** Any category name from the import that doesn't exist in the user's library is auto-created.

5. **Deduplicate:** Exact duplicates (same `categoryId + start_ms + end_ms`) are skipped to prevent double-import.

6. **Preview plan:** Before writing to DB, the user sees:
   - Total segments count, date range
   - Breakdown by category (count + total time)
   - Unmatched domain names (to manually review)

7. **Confirm import:** Single tap applies all segments to the DB.

---

### 6.9 Excel Export

**Location:** Settings → Export to Excel

Generates a `.xlsx` file of all time blocks within a selected date range.

#### Date Range Options

- Today
- Last 7 days
- Last 30 days
- All time
- Custom (date picker)

#### Output Columns

| Column | Description |
|--------|-------------|
| Date | YYYY-MM-DD |
| Start | HH:MM (local time) |
| End | HH:MM (local time) |
| Duration (min) | Block length in decimal minutes |
| Category | Category name |
| Type | focus / distraction / neutral |
| Note | User's optional note |
| Link | Clickable hyperlink (for Chrome-imported blocks) |

The Link column uses Excel's hyperlink cell format — URLs are clickable when opened in Excel or Google Sheets.

---

### 6.10 Multi-Select & Bulk Actions

**Location:** Today Screen → Timeline and History → Day Detail

A toggle button switches the timeline into **selection mode**:

- Checkboxes appear on each row.
- Tap rows to select/deselect.
- "Select All" / "Deselect All" header controls.
- **Bulk Delete:** Deletes all selected blocks with a single confirmation.
- Exiting selection mode (toggle off) clears the selection.

This is primarily used for cleaning up erroneously logged blocks or removing imported history segments that are unwanted.

---

### 6.11 Cross-Device Real-Time Sync

Focus-TimeLlog is designed to be used across **phone, tablet, and desktop** simultaneously.

#### Architecture

```
User Action (any device)
    │
    ▼
FocusLogContext (optimistic local update)
    │
    ▼ (async, fire-and-forget)
Supabase DB mutation (INSERT/UPDATE/DELETE)
    │
    ▼ (broadcasted via Postgres WAL)
Supabase Realtime channel
    │
    ├──▶ Same device: state already up-to-date (ignored or reconciled)
    └──▶ Other devices: receive change event → update local state
```

#### Key Properties

| Property | Detail |
|----------|--------|
| **Optimistic updates** | UI responds immediately without waiting for DB confirmation |
| **Realtime channel** | Subscribes to `postgres_changes` on `time_blocks` and `categories` |
| **First-login migration** | On first DB session, localStorage blocks are migrated to the user's Supabase account, preserving history from before sign-up |
| **Active timer persistence** | Active session state is stored in localStorage so a running timer survives a browser tab refresh; it is committed to DB on Stop |

---

## 7. UX & Design Principles

### 7.1 Mobile-First

- Maximum content width: **448px** (comfortable one-thumb reach on all phones)
- Bottom navigation bar (AppShell) with 4 tabs: Timer, Dashboard, History, Settings
- All interactive targets meet 44×44px minimum touch target size
- Haptic feedback on key interactions (Web Vibration API)

### 7.2 Speed Over Configuration

- Logging an activity requires exactly **one tap** (select category + tap Start)
- No required text entry; all text fields are optional
- No hierarchy: no projects, clients, or sub-tasks unless the user names their categories that way

### 7.3 Emotional Legibility

- Three types — Focus, Distraction, Neutral — reduce ambiguity
- Color coding is consistent throughout (blue = focus, red = distraction, gray = neutral)
- Dashboard "Focus %" gives a single number that summarizes the day's quality

### 7.4 Dark-First Design

- Default theme is dark mode (optimized for low-distraction environments)
- Light mode available as an explicit toggle
- Colors chosen for readability in both modes

### 7.5 Progressive Disclosure

- Primary screen (Timer) shows only what's needed to log right now
- Analytics are a separate tab, visited intentionally
- Advanced features (import, export, delete) are buried in Settings to prevent accidental activation

### 7.6 Graceful Degradation

- App works offline with localStorage; syncs when network returns
- Toast notifications confirm actions without blocking the UI
- Empty states on Dashboard/History include helpful messages, not blank screens

---

## 8. State Management Architecture

### 8.1 Context Providers (Global)

| Provider | Responsibility |
|----------|---------------|
| `AuthContext` | User session; `{ user, session, ready, signOut }` |
| `FocusLogProvider` | All time-tracking state and mutations |
| `FilterProvider` | Date/time range filter shared across Dashboard + History |

### 8.2 FocusLogProvider — State Shape

```typescript
{
  categories: Category[];       // all user categories
  blocks: TimeBlock[];          // all time blocks loaded from DB
  active: ActiveSession | null; // current running/paused activity
  theme: "dark" | "light";
  ready: boolean;               // data loaded from DB
  syncing: boolean;             // DB write in progress
  liveTick: number;             // updates every 250ms (timer display)
}
```

### 8.3 FocusLogProvider — Mutations

| Mutation | Description |
|----------|-------------|
| `startActivity(categoryId)` | Creates new active session |
| `pauseActivity()` | Freezes timer; starts break block |
| `resumeActivity()` | Ends break block; restarts timer |
| `stopActivity(note?)` | Closes active block; writes to DB |
| `cancelActivity()` | Discards current session without saving |
| `addPastBlock(block)` | Insert historical block |
| `addManyPastBlocks(blocks[])` | Bulk insert (Chrome import) |
| `updateBlock(id, changes)` | Edit an existing block |
| `deleteBlock(id)` | Delete single block |
| `deleteBlocks(ids[])` | Bulk delete |
| `addCategory(cat)` | Create category |
| `updateCategory(id, changes)` | Edit category |
| `deleteCategory(id)` | Remove category |
| `reorderCategories(ids[])` | Set new sort order |
| `clearAllData()` | Wipe all user data |
| `setTheme(theme)` | Toggle dark/light |

### 8.4 Data Flow

All mutations follow the same pattern:

1. **Validate locally** (type checks, date logic).
2. **Apply optimistically** to in-memory React state.
3. **Write to Supabase** asynchronously (fire-and-forget).
4. **Realtime event** arrives on all connected devices and updates their state.

Errors are surfaced via Sonner toast notifications; DB errors do not roll back optimistic state (eventual consistency model).

---

## 9. Security & Data Privacy

| Concern | Implementation |
|---------|---------------|
| **Row-Level Security** | All Supabase tables enforce `auth.uid() = user_id` on SELECT, INSERT, UPDATE, DELETE |
| **Auth tokens** | Managed by Supabase Auth; refresh tokens stored in browser storage |
| **Google OAuth** | Delegated through Lovable broker; app never sees Google credentials |
| **No server-side processing** | App is a static SPA; no custom backend; no server-side logging of user data |
| **Data deletion** | "Delete All Data" performs a hard delete on all user rows in both tables |
| **Local data** | localStorage used only for ephemeral state (active timer, theme, filters); no PII stored locally |

---

## 10. Metrics & Success Criteria

### Engagement Metrics (Product Health)

| Metric | Description |
|--------|-------------|
| **DAU / WAU** | Users who log at least one block per day / week |
| **Blocks per active day** | Average number of time blocks logged on days the user opens the app |
| **Timer starts per session** | How often users actually use the timer vs. just viewing data |
| **Focus % trend** | Average focus percentage per user over rolling 30 days (are users improving?) |
| **Import usage** | % of users who have performed at least one Chrome import |
| **Export usage** | % of users who have exported data |

### Retention Metrics

| Metric | Target |
|--------|--------|
| D1 Retention | User returns the day after sign-up |
| D7 Retention | User still active after 7 days |
| D30 Retention | User still active after 30 days |

### Performance Metrics

| Metric | Target |
|--------|--------|
| Timer start latency | < 100ms (optimistic, no DB round-trip on the critical path) |
| Dashboard load time | < 1s for 30-day range |
| Chrome import (1000 entries) | < 3s end-to-end |
| Real-time sync propagation | < 2s between devices |

---

## 11. Known Limitations & Future Opportunities

### Current Limitations

| Limitation | Impact |
|-----------|--------|
| No overlap detection | Two blocks can be logged for the same time range (data integrity risk during Chrome import) |
| No offline queue | DB writes fire-and-forget; a write that fails during offline is silently lost |
| Category renames don't backfill | Historical blocks retain the old `category_name` snapshot |
| No notifications / reminders | App cannot prompt users to start logging; relies on self-discipline |
| Single user per account | No team/shared view |
| Chrome import mapping is hardcoded | New domains require a code change to classify correctly; no user-configurable rules |
| No merge functionality | UI scaffolding exists; merge operation is not yet implemented |

### Future Opportunities

| Opportunity | Value |
|-------------|-------|
| **Smart notifications** | "You've been on Instagram for 30 minutes" push alerts |
| **Weekly email digest** | Focus/distraction summary sent to user every Monday |
| **Goals & streaks** | "Focus 4h today" daily goal with streak counter |
| **Category auto-suggest** | ML model trained on user's history to pre-select likely next category |
| **Browser extension** | Log directly from Chrome without switching to the app |
| **User-configurable import rules** | Let users map custom domains to their own categories |
| **Block merging** | Merge consecutive same-category blocks into one |
| **Pomodoro mode** | Built-in 25/5 timer with automatic break scheduling |
| **Team / manager view** | Aggregated reports for remote teams (opt-in, privacy-preserving) |
| **Offline-first with sync queue** | Queue failed DB writes and replay on reconnect |
| **API / Webhooks** | Let power users push data to Notion, Obsidian, or custom dashboards |

---

*Document prepared based on codebase analysis of Focus-TimeLlog v1.0 (current production state).*
*Last updated: May 2026*
