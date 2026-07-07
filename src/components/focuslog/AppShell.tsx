import { Link, Outlet } from "@tanstack/react-router";
import { Clock, BarChart3, Calendar, Settings as SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/", label: "Timer", icon: Clock, exact: true },
  { to: "/dashboard", label: "Dashboard", icon: BarChart3, exact: false },
  { to: "/history", label: "History", icon: Calendar, exact: false },
  { to: "/settings", label: "Settings", icon: SettingsIcon, exact: false },
] as const;

export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop sidebar (md+) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-background md:flex">
        <div className="px-6 pb-2 pt-6">
          <span className="text-lg font-bold tracking-tight text-foreground">FocusLog</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                activeOptions={{ exact: t.exact }}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-accent"
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Content: full width on desktop (offset by the sidebar), single column on mobile */}
      <div className="flex min-h-dvh w-full flex-col md:pl-56">
        <main className="mx-auto w-full max-w-md flex-1 pb-24 md:max-w-6xl md:px-8 md:pb-10">
          {children ?? <Outlet />}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                activeOptions={{ exact: t.exact }}
                className="flex flex-col items-center gap-1 py-3 text-[11px] font-medium text-muted-foreground transition-colors data-[status=active]:text-accent"
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
