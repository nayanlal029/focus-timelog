import { supabase } from "@/integrations/supabase/client";

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

export function isValidHandle(h: string): boolean {
  return HANDLE_RE.test(h);
}

export function looksLikeEmail(input: string): boolean {
  const value = input.trim();
  return !value.startsWith("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Suggest a handle from an email local-part, sanitized to the allowed charset. */
export function suggestHandleFromEmail(email: string): string {
  const local = email.split("@")[0]?.toLowerCase() ?? "user";
  let base = local.replace(/[^a-z0-9_]/g, "").slice(0, 16);
  if (base.length < 3) base = (base + "user").slice(0, 6);
  return base;
}

/** Look up the email for a given handle via SECURITY DEFINER RPC. */
export async function emailForHandle(handle: string): Promise<string | null> {
  const h = handle.trim().toLowerCase();
  if (!isValidHandle(h)) return null;
  const { data, error } = await supabase.rpc("get_email_for_handle", { _handle: h });
  if (error || !data) return null;
  return data as string;
}

/** Returns true if the handle is available (not taken by another user). */
export async function isHandleAvailable(handle: string, excludeUserId?: string): Promise<boolean> {
  const h = handle.trim().toLowerCase();
  if (!isValidHandle(h)) return false;
  const { data, error } = await supabase.rpc("is_handle_available", {
    _handle: h,
    _exclude_user: excludeUserId ?? undefined,
  });
  if (error) return false;
  return !!data;
}

/** Get the current user's profile row (handle + email). */
export async function getMyProfile(userId: string) {
  const { data } = await supabase
    .from("user_profiles")
    .select("handle, email")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

/** Upsert the current user's profile. Throws on uniqueness / format failure. */
export async function saveMyHandle(userId: string, email: string, handle: string) {
  const h = handle.trim().toLowerCase();
  if (!isValidHandle(h)) throw new Error("Handle must be 3–20 chars: a–z, 0–9, _");
  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      { user_id: userId, handle: h, email: email.toLowerCase() },
      { onConflict: "user_id" },
    );
  if (error) {
    if (error.code === "23505") throw new Error("That User ID is already taken.");
    throw new Error(error.message);
  }
  return h;
}

/** Try to claim an auto-suggested handle on signup; on collision append digits until free. */
export async function autoClaimHandle(userId: string, email: string): Promise<string | null> {
  const base = suggestHandleFromEmail(email);
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(Math.random() * 9000) + 1000}`.slice(0, 20);
    try {
      return await saveMyHandle(userId, email, candidate);
    } catch {
      // keep trying
    }
  }
  return null;
}
