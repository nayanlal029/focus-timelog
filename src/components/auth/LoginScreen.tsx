import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { suggestHandle, saveHandle, emailForHandle } from "@/lib/focuslog/handle";

export function LoginScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [identifier, setIdentifier] = useState(""); // email or handle
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { enterGuest } = useAuth();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;
    setBusy(true);
    try {
      if (mode === "login") {
        // Resolve handle → email if no @ present
        let email = identifier.trim();
        if (!email.includes("@")) {
          const resolved = await emailForHandle(email);
          if (!resolved) {
            toast.error("User ID not found. Try signing in with your email instead.");
            return;
          }
          email = resolved;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Signup always requires a real email
        const email = identifier.trim();
        if (!email.includes("@")) {
          toast.error("Please enter your email address to create an account.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        // Auto-assign a handle for new users
        if (data.user) {
          const handle = suggestHandle(email);
          await saveHandle(data.user.id, handle, email);
        }
        toast.success("Account created. You're signed in.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        const m = result.error instanceof Error ? result.error.message : String(result.error);
        toast.error(m);
        setBusy(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">FocusLog</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{mode === "login" ? "Welcome back" : "Create account"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your data syncs across phone, tablet, desktop, and watch.</p>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="space-y-1">
            <Label htmlFor="identifier">{mode === "login" ? "Email or User ID" : "Email"}</Label>
            <Input
              id="identifier"
              type="text"
              autoComplete="email"
              placeholder={mode === "login" ? "e.g. nlal029 or you@email.com" : "you@email.com"}
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Sign up"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
          Continue with Google
        </Button>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "login" ? "No account? Sign up" : "Already have an account? Sign in"}
        </button>

        <button
          type="button"
          onClick={enterGuest}
          className="mt-2 w-full text-center text-xs text-muted-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
        >
          Continue without signing in
        </button>
        <p className="mt-1 text-center text-[10px] text-muted-foreground/70">
          Data stays on this device. Sign in later to sync.
        </p>
      </div>
    </div>
  );
}
