import { PLANS, type PlanId } from "@/lib/plans";

const BASE = "https://backend.payhero.co.ke/api/v2";
const credentialValue = (value: string, label: "api username" | "api password") =>
  value.trim().replace(new RegExp(`^${label}\\s*:\\s*`, "i"), "").trim();

export const PAYHERO_CALLBACK_URL =
  process.env.PAYHERO_CALLBACK_URL ||
  `${process.env.SUPABASE_URL ?? ""}/functions/v1/payhero-webhook`;

export async function payheroAuth() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("payment_settings" as never)
    .select("api_username, api_password, channel_id")
    .eq("provider", "payhero")
    .maybeSingle();
  const row = data as null | { api_username: string; api_password: string; channel_id: string };
  const userValue = row?.api_username ?? process.env.PAYHERO_API_USERNAME;
  const passValue = row?.api_password ?? process.env.PAYHERO_API_PASSWORD;
  const user = userValue ? credentialValue(userValue, "api username") : undefined;
  const pass = passValue ? credentialValue(passValue, "api password") : undefined;
  const channel = row?.channel_id ?? process.env.PAYHERO_CHANNEL_ID;
  if (!user || !pass || !channel) throw new Error("Payments are not configured.");
  return { header: "Basic " + btoa(`${user}:${pass}`), channelId: Number(channel) };
}

export async function payheroStkPush(opts: { phone: string; amount: number; externalRef: string; name?: string }) {
  const { header, channelId } = await payheroAuth();
  if (!PAYHERO_CALLBACK_URL) throw new Error("Payments are not configured: set PAYHERO_CALLBACK_URL.");
  const res = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: { Authorization: header, "content-type": "application/json" },
    body: JSON.stringify({
      amount: opts.amount,
      phone_number: opts.phone,
      channel_id: channelId,
      provider: "m-pesa",
      external_reference: opts.externalRef,
      customer_name: opts.name,
      callback_url: PAYHERO_CALLBACK_URL,
    }),
  });
  const raw = await res.text();
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw); } catch { /* ignore */ }
  if (!res.ok || body.success === false) {
    const msg = (body.error_message ?? body.message ?? body.error) as string | undefined;
    console.error("PayHero STK failed", { status: res.status, message: msg ?? "Provider returned an error." });
    throw new Error(msg ? `PayHero: ${msg}` : `Payment provider error (${res.status}).`);
  }
  return {
    reference: (body.reference as string) ?? null,
    checkoutRequestId: (body.CheckoutRequestID as string) ?? null,
  };
}

/** Returns "success" | "failed" | "pending" */
export async function payheroStatus(reference: string): Promise<"success" | "failed" | "pending"> {
  const { header } = await payheroAuth();
  try {
    const res = await fetch(`${BASE}/transaction-status?reference=${encodeURIComponent(reference)}`, {
      headers: { Authorization: header },
    });
    if (!res.ok) {
      console.error("PayHero status failed", res.status, await res.text());
      return "pending";
    }
    const body = (await res.json()) as { status?: string };
    const s = String(body.status ?? "").toLowerCase();
    if (["success", "successful", "completed", "paid"].includes(s)) return "success";
    if (["failed", "cancelled", "canceled", "expired", "rejected"].includes(s)) return "failed";
    return "pending";
  } catch (e) {
    console.error("PayHero status error", e);
    return "pending";
  }
}

type Admin = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

export async function ensureSubscription(admin: Admin, payment: { id: string; user_id: string; plan_type: string }) {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, plan, remaining_reveals, is_unlimited")
    .eq("payment_id", payment.id)
    .maybeSingle();
  if (existing) return existing;
  const planId = payment.plan_type as PlanId;
  const plan = PLANS[planId];
  if (!plan) throw new Error("Unknown plan on payment.");
  const start = new Date();
  const expiry = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 30);
  const { data, error } = await admin
    .from("subscriptions")
    .insert({
      user_id: payment.user_id,
      plan: planId,
      remaining_reveals: plan.unlimited ? 0 : plan.reveals,
      is_unlimited: plan.unlimited,
      start_date: start.toISOString(),
      expiry_date: expiry.toISOString(),
      payment_id: payment.id,
    })
    .select("id, plan, remaining_reveals, is_unlimited")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
