import { supabase } from "@/integrations/supabase/client";

export function suggestHandle(email: string): string {
  const prefix = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = prefix.slice(0, 6).padEnd(3, "x");
  const suffix = Math.floor(Math.random() * 900 + 100).toString();
  return (base + suffix).slice(0, 10);
}

export function isValidHandle(h: string): boolean {
  return /^[a-z0-9]{3,10}$/.test(h);
}

export async function emailForHandle(handle: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_profiles")
    .select("email")
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  return data?.email ?? null;
}

export async function fetchHandle(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_profiles")
    .select("handle")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.handle ?? null;
}

export async function saveHandle(userId: string, handle: string, email: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: userId, handle: handle.toLowerCase(), email });
  return { error: error as Error | null };
}

export async function isHandleTaken(handle: string, currentUserId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("handle", handle.toLowerCase())
    .neq("user_id", currentUserId)
    .maybeSingle();
  return data !== null;
}
