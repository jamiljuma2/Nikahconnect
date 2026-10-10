import { supabase } from "@/integrations/supabase/client";

/** Route-level navigation guard; privileged data and actions remain server-guarded. */
export async function isCurrentUserAdmin() {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (sessionError || !userId) return false;

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    return !error && !!data;
  } catch (error) {
    console.error("Could not verify admin route access", error);
    return false;
  }
}
