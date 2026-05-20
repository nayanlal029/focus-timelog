import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  ready: boolean;
  guest: boolean;
  enterGuest: () => void;
  exitGuest: () => void;
  signOut: () => Promise<void>;
}

const GUEST_KEY = "focuslog.guest";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try { setGuest(localStorage.getItem(GUEST_KEY) === "1"); } catch { /* ignore */ }
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        // Signing in exits guest mode.
        try { localStorage.removeItem(GUEST_KEY); } catch { /* ignore */ }
        setGuest(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const enterGuest = useCallback(() => {
    try { localStorage.setItem(GUEST_KEY, "1"); } catch { /* ignore */ }
    setGuest(true);
  }, []);

  const exitGuest = useCallback(() => {
    try { localStorage.removeItem(GUEST_KEY); } catch { /* ignore */ }
    setGuest(false);
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    try { localStorage.removeItem(GUEST_KEY); } catch { /* ignore */ }
    setGuest(false);
  };

  return (
    <AuthContext.Provider value={{
      user: session?.user ?? null,
      session,
      ready,
      guest,
      enterGuest,
      exitGuest,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
