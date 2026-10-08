import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
  return supabaseAdmin;
}

const mask = (s: string) => (s.length <= 4 ? "••••" : `${s.slice(0, 2)}••••${s.slice(-2)}`);

export const getPayheroSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context.userId);
    const { data } = await admin
      .from("payment_settings" as never)
      .select("api_username, channel_id, verified_at, updated_at")
      .eq("provider", "payhero")
      .maybeSingle();
    const row = data as null | { api_username: string; channel_id: string; verified_at: string | null; updated_at: string };
    return row
      ? {
          configured: true,
          usernameMasked: mask(row.api_username),
          channelId: row.channel_id,
          verifiedAt: row.verified_at,
          updatedAt: row.updated_at,
        }
      : { configured: false as const };
  });

const input = z.object({
  apiUsername: z.string().trim().min(3).max(200),
  apiPassword: z.string().trim().min(3).max(500),
  channelId: z.string().trim().regex(/^\d{1,10}$/, "Channel ID must be a number"),
});

/** Tests credentials against PayHero; saves them only if PayHero accepts them. */
export const savePayheroSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context.userId);
    const auth = "Basic " + btoa(`${data.apiUsername}:${data.apiPassword}`);

    const res = await fetch("https://backend.payhero.co.ke/api/v2/payment_channels", {
      headers: { Authorization: auth },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error("PayHero rejected these credentials. Check the API username and password.");
    }
    if (!res.ok) throw new Error(`Could not reach PayHero (${res.status}). Try again.`);

    const body = (await res.json().catch(() => null)) as unknown;
    const list: Array<Record<string, unknown>> = Array.isArray(body)
      ? body
      : ((body as { data?: unknown; payment_channels?: unknown })?.data as never) ??
        ((body as { payment_channels?: unknown })?.payment_channels as never) ??
        [];
    if (Array.isArray(list) && list.length > 0) {
      const found = list.some((c) => String(c.id) === data.channelId);
      if (!found) throw new Error("Credentials work, but that Channel ID isn't on your PayHero account.");
    }

    const now = new Date().toISOString();
    const { error } = await admin.from("payment_settings" as never).upsert({
      provider: "payhero",
      api_username: data.apiUsername,
      api_password: data.apiPassword,
      channel_id: data.channelId,
      verified_at: now,
      updated_by: context.userId,
      updated_at: now,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true, verifiedAt: now };
  });
