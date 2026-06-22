import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS, type PlanId } from "@/lib/plans";

const input = z.object({
  planId: z.enum(["starter", "standard", "premium"]),
  mpesaPhone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^\+?[0-9]+$/, "Use digits only, optionally prefixed with +"),
});

export const initiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const plan = PLANS[data.planId as PlanId];
    const apiKey = process.env.LIPANA_SECRET_KEY;
    if (!apiKey) throw new Error("Payments are not configured.");

    const phone = data.mpesaPhone.startsWith("+") ? data.mpesaPhone : `+${data.mpesaPhone}`;

    const res = await fetch("https://api.lipana.dev/v1/transactions/push-stk", {
      method: "POST",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ phone, amount: plan.price }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("Lipana STK push failed", res.status, txt);
      throw new Error("Payment provider rejected the request. Please try again.");
    }

    const body = (await res.json().catch(() => ({}))) as {
      transactionId?: string;
      transaction_id?: string;
      id?: string;
    };
    const transactionId = body.transactionId ?? body.transaction_id ?? body.id ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      transaction_id: transactionId,
      amount: plan.price,
      plan_type: data.planId,
      status: "pending",
      mpesa_phone: phone,
    });
    if (error) console.error("payment insert", error);

    return { transactionId, status: "pending" as const };
  });

export const getMyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { payments: data ?? [] };
  });
