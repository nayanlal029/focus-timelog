import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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

type Status = "checking" | "ready" | "error";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("checking");
  const [errMsg, setErrMsg] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendEmail, setResendEmail] = useState("");

  useEffect(() => {
    // 1) If the link itself carried an error in the hash, surface it now.
    if (typeof window !== "undefined" && window.location.hash) {
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const err = h.get("error") || h.get("error_code");
      if (err) {
        const desc = h.get("error_description")?.replace(/\+/g, " ") || err;
        setErrMsg(decodeURIComponent(desc));
        setStatus("error");
        return;
      }
    }

    // 2) Otherwise wait briefly for Supabase to parse the recovery tokens.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setStatus("ready");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus("ready");
    });

    // 3) Hard timeout so it never spins forever.
    const t = window.setTimeout(() => {
      setStatus((s) => {
        if (s === "checking") {
          setErrMsg("This reset link is invalid or has already been used.");
          return "error";
        }
        return s;
      });
    }, 4000);

    return () => { sub.subscription.unsubscribe(); window.clearTimeout(t); };
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

  const resend = async (e: FormEvent) => {
    e.preventDefault();
    if (!resendEmail.includes("@")) return toast.error("Enter your email address.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resendEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("New reset link sent. Check your inbox (and spam).");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">FocusLog</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {status === "error" ? "Link expired" : "Set a new password"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {status === "checking" && "Validating reset link…"}
            {status === "ready" && "Choose a new password for your account."}
            {status === "error" && errMsg}
          </p>
        </div>

        {status === "error" ? (
          <form onSubmit={resend} className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              Reset links work only once and expire quickly. Enter your email to get a new one.
            </p>
            <div className="space-y-1">
              <Label htmlFor="re">Email</Label>
              <Input id="re" type="email" autoComplete="email" required value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Send a new reset link
            </Button>
            <Link to="/" className="block text-center text-xs text-muted-foreground hover:text-foreground">
              Back to sign in
            </Link>
          </form>
        ) : (
          <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="space-y-1">
              <Label htmlFor="pw">New password</Label>
              <Input id="pw" type="password" autoComplete="new-password" required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={status !== "ready"} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pw2">Confirm password</Label>
              <Input id="pw2" type="password" autoComplete="new-password" required minLength={6}
                value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={status !== "ready"} />
            </div>
            <Button type="submit" className="w-full" disabled={status !== "ready" || busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
