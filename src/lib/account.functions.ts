import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const deactivateMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ deactivated_at: new Date().toISOString() })
      .eq("id", context.userId);

    if (error) throw new Error("Could not deactivate your account. Please try again.");
    return { ok: true as const };
  });

export const reactivateMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ deactivated_at: null })
      .eq("id", context.userId);

    if (error) throw new Error("Could not reactivate your account. Please try again.");
    return { ok: true as const };
  });

async function listProfilePhotoPaths(
  storage: SupabaseClient["storage"],
  folder: string,
): Promise<string[]> {
  const paths: string[] = [];
  const limit = 1000;

  for (let offset = 0; ; offset += limit) {
    const { data, error } = await storage.from("profile-photos").list(folder, { limit, offset });
    if (error) throw new Error("Could not prepare your profile photos for deletion.");
    if (!data?.length) break;

    for (const entry of data) {
      const path = `${folder}/${entry.name}`;
      if (entry.id) paths.push(path);
      else paths.push(...(await listProfilePhotoPaths(storage, path)));
    }
    if (data.length < limit) break;
  }

  return paths;
}

export const permanentlyDeleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    if (roleError) throw new Error("Could not verify account permissions. Please try again.");
    const { data: ownRole, error: ownRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (ownRoleError) throw new Error("Could not verify account permissions. Please try again.");
    if (ownRole && (count ?? 0) <= 1) {
      throw new Error(
        "The last administrator account cannot be deleted. Assign another administrator first.",
      );
    }

    const photoPaths = await listProfilePhotoPaths(supabaseAdmin.storage, context.userId);
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (deleteError) throw new Error("Your account could not be deleted. Please try again.");

    let photosRemoved = true;
    if (photoPaths.length) {
      const { error } = await supabaseAdmin.storage.from("profile-photos").remove(photoPaths);
      if (error) {
        photosRemoved = false;
        console.error("Account deleted but profile photo cleanup failed", error);
      }
    }

    return { ok: true as const, photosRemoved };
  });
