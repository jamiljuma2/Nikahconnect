import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYHERO_BASE = "https://backend.payhero.co.ke/api/v2";
const PLANS = {
  starter: { reveals: 2, unlimited: false },
  standard: { reveals: 5, unlimited: false },
  premium: { reveals: 0, unlimited: true },
} as const;

type PlanId = keyof typeof PLANS;
type Payment = {
  id: string;
  user_id: string;
  plan_type: PlanId;
  transaction_id: string | null;
  status: "pending" | "success" | "failed";
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function payheroAuth() {
  const { data: settings } = await admin
    .from("payment_settings")
    .select("api_username, api_password, channel_id")
    .eq("provider", "payhero")
    .maybeSingle();

  const username = settings?.api_username ?? Deno.env.get("PAYHERO_API_USERNAME");
  const password = settings?.api_password ?? Deno.env.get("PAYHERO_API_PASSWORD");
  const channelId = settings?.channel_id ?? Deno.env.get("PAYHERO_CHANNEL_ID");
  if (!username || !password || !channelId) throw new Error("PayHero is not configured.");

  return {
    authorization: `Basic ${btoa(`${username}:${password}`)}`,
    channelId: Number(channelId),
  };
}

async function payheroStatus(reference: string) {
  const { authorization } = await payheroAuth();
  const response = await fetch(
    `${PAYHERO_BASE}/transaction-status?reference=${encodeURIComponent(reference)}`,
    { headers: { Authorization: authorization } },
  );
  if (!response.ok) return "pending" as const;

  const body = (await response.json()) as { status?: string };
  const status = String(body.status ?? "").toLowerCase();
  if (["success", "successful", "completed", "paid"].includes(status)) return "success" as const;
  if (["failed", "cancelled", "canceled", "expired", "rejected"].includes(status)) return "failed" as const;
  return "pending" as const;
}

async function activateSubscription(payment: Payment) {
  const existing = await admin
    .from("subscriptions")
    .select("id")
    .eq("payment_id", payment.id)
    .maybeSingle();
  if (existing.data) return;

  const plan = PLANS[payment.plan_type];
  if (!plan) throw new Error("Unknown payment plan.");

  const started = new Date();
  const expires = new Date(started.getTime() + 30 * 24 * 60 * 60 * 1000);
  const { error } = await admin.from("subscriptions").insert({
    user_id: payment.user_id,
    plan: payment.plan_type,
    remaining_reveals: plan.reveals,
    is_unlimited: plan.unlimited,
    start_date: started.toISOString(),
    expiry_date: expires.toISOString(),
    payment_id: payment.id,
  });
  if (error) throw error;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: { response?: { ExternalReference?: string } };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const externalReference = payload.response?.ExternalReference;
  if (!externalReference) return json({ error: "Missing ExternalReference" }, 400);

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select("id, user_id, plan_type, transaction_id, status")
    .eq("idempotency_key", externalReference)
    .maybeSingle<Payment>();
  if (paymentError) return json({ error: paymentError.message }, 500);
  if (!payment?.transaction_id) return json({ error: "Payment not found" }, 404);

  const status = payment.status === "success" ? "success" : await payheroStatus(payment.transaction_id);
  if (status === "success") {
    const { error } = await admin.from("payments").update({ status: "success" }).eq("id", payment.id);
    if (error) return json({ error: error.message }, 500);
    await activateSubscription(payment);
  } else if (status === "failed") {
    const { error } = await admin
      .from("payments")
      .update({ status: "failed" })
      .eq("id", payment.id)
      .eq("status", "pending");
    if (error) return json({ error: error.message }, 500);
  }

  return json({ ok: true, status });
});
