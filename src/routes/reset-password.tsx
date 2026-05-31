import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Reset password · FocusLog" }] }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery tokens from the URL hash automatically and
    // emits a PASSWORD_RECOVERY event. Wait for a session before allowing update.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    if (password !== confirm) return toast.error("Passwords don't match.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">FocusLog</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Set a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {ready ? "Choose a new password for your account." : "Validating reset link…"}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="space-y-1">
            <Label htmlFor="pw">New password</Label>
            <Input id="pw" type="password" autoComplete="new-password" required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)} disabled={!ready} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pw2">Confirm password</Label>
            <Input id="pw2" type="password" autoComplete="new-password" required minLength={6}
              value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={!ready} />
          </div>
          <Button type="submit" className="w-full" disabled={!ready || busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
