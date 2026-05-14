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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      <main className="flex-1 pb-24">{children ?? <Outlet />}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur">
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
