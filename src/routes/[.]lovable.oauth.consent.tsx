import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type AuthDetails = {
  client?: { name?: string; client_uri?: string };
  redirect_url?: string;
  redirect_to?: string;
};

// Beta OAuth namespace — typed locally so we don't depend on SDK types.
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};
function oauthNs(): OAuthNs {
  return (supabase.auth as unknown as { oauth: OAuthNs }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  component: Consent,
});

function Consent() {
  const { user, ready } = useAuth();
  const { authorization_id } = Route.useSearch();
  const [details, setDetails] = useState<AuthDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user || !authorization_id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await oauthNs().getAuthorizationDetails(authorization_id);
      if (cancelled) return;
      if (error) { setLoadError(error.message); return; }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => { cancelled = true; };
  }, [ready, user, authorization_id]);

  if (!authorization_id) {
    return <main className="mx-auto max-w-md p-8 text-sm text-muted-foreground">Missing authorization_id.</main>;
  }
  if (!ready) return null;
  if (!user) {
    // AuthGate in __root.tsx already renders the sign-in screen for
    // unauthenticated users; nothing to render here until they sign in.
    return null;
  }

  async function decide(approve: boolean) {
    setBusy(true);
    setDecideError(null);
    const ns = oauthNs();
    const { data, error } = approve
      ? await ns.approveAuthorization(authorization_id)
      : await ns.denyAuthorization(authorization_id);
    if (error) { setBusy(false); setDecideError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setDecideError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Connect {clientName} to FocusLogNL
      </h1>
      <p className="text-sm text-muted-foreground">
        This lets {clientName} read and write your FocusLogNL data as you. You can revoke access at any time.
      </p>
      {loadError && <p role="alert" className="text-sm text-destructive">Could not load this request: {loadError}</p>}
      {decideError && <p role="alert" className="text-sm text-destructive">{decideError}</p>}
      <div className="flex gap-2">
        <button
          disabled={busy || !details}
          onClick={() => decide(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Approve
        </button>
        <button
          disabled={busy}
          onClick={() => decide(false)}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
        >
          Deny
        </button>
      </div>
    </main>
  );
}
