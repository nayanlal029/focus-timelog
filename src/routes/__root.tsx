import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { FocusLogProvider } from "@/lib/focuslog/context";
import { FilterProvider } from "@/lib/focuslog/filter-context";
import { AppShell } from "@/components/focuslog/AppShell";
import { AuthProvider } from "@/lib/auth-context";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Page not found.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1F3A5F" },
      { title: "FocusLogNL" },
      { name: "description", content: "Honest record of focus vs distraction. Log your day as a continuous timeline." },
      { property: "og:title", content: "FocusLogNL" },
      { name: "twitter:title", content: "FocusLogNL" },
      { property: "og:description", content: "Honest record of focus vs distraction. Log your day as a continuous timeline." },
      { name: "twitter:description", content: "Honest record of focus vs distraction. Log your day as a continuous timeline." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/20b637b7-4d37-44d0-a171-4aa05ade5054/id-preview-c2f610ff--4c52c0d6-3f2f-48e6-af6c-5c3db601622f.lovable.app-1778725331272.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/20b637b7-4d37-44d0-a171-4aa05ade5054/id-preview-c2f610ff--4c52c0d6-3f2f-48e6-af6c-5c3db601622f.lovable.app-1778725331272.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <FocusLogProvider>
            <FilterProvider>
              <AppShell>
                <Outlet />
              </AppShell>
            </FilterProvider>
          </FocusLogProvider>
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}

import { useAuth } from "@/lib/auth-context";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { useRouterState } from "@tanstack/react-router";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, ready, guest } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!ready) {
    return <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">Loading…</div>;
  }
  // Public auth-recovery route: always reachable.
  if (pathname === "/reset-password") return <>{children}</>;
  if (!user && !guest) return <LoginScreen />;
  return <>{children}</>;
}
