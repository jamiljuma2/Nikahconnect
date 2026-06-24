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
  idempotencyKey: z.string().min(8).max(100),
});

export const initiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const plan = PLANS[data.planId as PlanId];
    const apiKey = process.env.LIPANA_SECRET_KEY;
    if (!apiKey) throw new Error("Payments are not configured.");
    if (!/^lip_sk_(test|live)_/.test(apiKey)) {
      throw new Error(
        "Payments key looks wrong. Use your Lipana SECRET key (starts with lip_sk_test_ or lip_sk_live_), not the publishable key.",
      );
    }

    // Lipana expects Safaricom MSISDN format: 254XXXXXXXXX (no leading + or 0).
    let phone = data.mpesaPhone.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "254" + phone.slice(1);
    if (phone.startsWith("7") || phone.startsWith("1")) phone = "254" + phone;
    if (!/^254[17]\d{8}$/.test(phone)) {
      throw new Error("Enter a valid Safaricom number, e.g. 0712345678 or 254712345678.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Idempotency: if a payment with this key already exists for the user, return it.
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("transaction_id, status")
      .eq("user_id", context.userId)
      .eq("idempotency_key", data.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return {
        transactionId: existing.transaction_id,
        status: existing.status as "pending" | "success" | "failed",
        idempotent: true as const,
      };
    }

    // Guard against double payments: block if a recent pending payment exists.
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: pending } = await supabaseAdmin
      .from("payments")
      .select("id, created_at")
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .gte("created_at", twoMinAgo)
      .limit(1)
      .maybeSingle();
    if (pending) {
      throw new Error(
        "You already have a payment in progress. Check your phone for the M-Pesa prompt, or wait a minute before trying again.",
      );
    }

    const res = await fetch("https://api.lipana.dev/v1/transactions/push-stk", {
      method: "POST",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ phone, amount: plan.price }),
    });

    const rawBody = await res.text();
    if (!res.ok) {
      console.error("Lipana STK push failed", res.status, rawBody);
      let msg = `Payment provider error (${res.status}).`;
      try {
        const j = JSON.parse(rawBody) as { message?: string; error?: string };
        if (j.message || j.error) msg = `Lipana: ${j.message ?? j.error}`;
      } catch {
        if (rawBody) msg += ` ${rawBody.slice(0, 200)}`;
      }
      throw new Error(msg);
    }

    let body: {
      transactionId?: string;
      transaction_id?: string;
      id?: string;
      data?: { transactionId?: string; checkoutRequestID?: string; id?: string };
    } = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      // ignore
    }
    const transactionId =
      body.transactionId ??
      body.transaction_id ??
      body.id ??
      body.data?.transactionId ??
      body.data?.id ??
      body.data?.checkoutRequestID ??
      null;

    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      transaction_id: transactionId,
      amount: plan.price,
      plan_type: data.planId,
      status: "pending",
      mpesa_phone: phone,
      idempotency_key: data.idempotencyKey,
    });
    if (error) {
      // Unique violation = a concurrent request beat us with the same key. Return the existing row.
      if ((error as { code?: string }).code === "23505") {
        const { data: dup } = await supabaseAdmin
          .from("payments")
          .select("transaction_id, status")
          .eq("user_id", context.userId)
          .eq("idempotency_key", data.idempotencyKey)
          .maybeSingle();
        if (dup) {
          return {
            transactionId: dup.transaction_id,
            status: dup.status as "pending" | "success" | "failed",
            idempotent: true as const,
          };
        }
      }
      console.error("payment insert", error);
    }

    return { transactionId, status: "pending" as const, idempotent: false as const };
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
