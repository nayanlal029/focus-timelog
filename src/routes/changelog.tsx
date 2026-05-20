import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/changelog")({
  head: () => ({ meta: [{ title: "FocusLog — Changelog" }] }),
  component: ChangelogScreen,
});

interface Entry {
  date: string; // ISO
  version?: string;
  title: string;
  items: string[];
}

const CHANGELOG: Entry[] = [
  {
    date: "2026-05-20",
    version: "1.1",
    title: "Pomodoro, pause alerts & a fairer dashboard",
    items: [
      "New Pomodoro mode on the Timer screen with configurable work/break (default 25/5).",
      "Escalating distraction alerts at 5, 10, 15, 30, 60, 90 min while paused (toggle in Settings).",
      "Guest mode — log time without signing in; data stays on the device until you sign in to sync.",
      "Search box added to category chips on Timer and the Day timeline in History.",
      "Bug fix: Dashboard now clips blocks to the selected range, so totals match reality even when activities span midnight or extend past the range.",
      "Added this Changelog page.",
    ],
  },
  {
    date: "2026-05-14",
    version: "1.0",
    title: "Cloud sync & sample categories",
    items: [
      "Authentication with email/password and Google sign-in.",
      "Cloud sync across devices via real-time updates.",
      "Sample categories seeded for new users: Work, Work-Meet, Study, Study-Product, Gym, Podcast, Social-Insta.",
      "Past activities import deduplicates exact-match segments.",
    ],
  },
  {
    date: "2026-05-01",
    version: "0.9",
    title: "Foundations",
    items: [
      "Continuous timeline timer with focus/distraction/neutral categorization.",
      "Focus Mode full-screen view with pause/resume.",
      "Dashboard with per-day breakdown and top categories.",
      "History calendar with day timeline and Gantt view.",
      "Chrome history import and Excel export.",
      "Multi-select & bulk actions for blocks.",
    ],
  },
];

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function ChangelogScreen() {
  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
      <header>
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">What's new</div>
        <h1 className="mt-1 text-2xl font-semibold">Changelog</h1>
      </header>

      <ol className="relative space-y-5 border-l border-border pl-5">
        {CHANGELOG.map((e) => (
          <li key={e.date + e.title} className="relative">
            <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-background" />
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="tabular-nums">{fmtDate(e.date)}</span>
              {e.version && <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground/80">v{e.version}</span>}
            </div>
            <h2 className="mt-1 text-base font-semibold leading-tight">{e.title}</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground/85">
              {e.items.map((it, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
