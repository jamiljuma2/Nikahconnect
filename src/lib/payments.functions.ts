import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS, type PlanId } from "@/lib/plans";

const input = z.object({
  // Starter remains legacy-only. Current checkout offers the two membership tiers.
  planId: z.enum(["standard", "premium"]),
  mpesaPhone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^\+?[0-9]+$/, "Use digits only, optionally prefixed with +"),
  idempotencyKey: z.string().min(8).max(100),
});

export const initiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const plan = PLANS[data.planId as PlanId];
    const { payheroStkPush } = await import("@/lib/payhero.server");

    let phone = data.mpesaPhone.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "254" + phone.slice(1);
    if (phone.startsWith("7") || phone.startsWith("1")) phone = "254" + phone;
    if (!/^254[17]\d{8}$/.test(phone)) {
      throw new Error("Enter a valid Safaricom number, e.g. 0712345678 or 254712345678.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: pending } = await supabaseAdmin
      .from("payments")
      .select("id")
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

    const { reference, checkoutRequestId } = await payheroStkPush({
      phone,
      amount: plan.price,
      externalRef: data.idempotencyKey,
    });
    const transactionId = reference ?? checkoutRequestId;

    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: context.userId,
      transaction_id: transactionId,
      amount: plan.price,
      plan_type: data.planId,
      status: "pending",
      mpesa_phone: phone,
      idempotency_key: data.idempotencyKey,
    });
    if (error) console.error("payment insert", error);

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

const verifyInput = z.object({ transactionId: z.string().min(4) });

/** Confirms a payment with PayHero and activates the plan. Safe to call repeatedly. */
export const verifyAndActivatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => verifyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { payheroStatus, ensureSubscription } = await import("@/lib/payhero.server");

    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("user_id", context.userId)
      .eq("transaction_id", data.transactionId)
      .maybeSingle();
    if (!payment) throw new Error("Payment not found.");
    const paymentUserId = payment.user_id;
    if (paymentUserId !== context.userId) throw new Error("Payment not found.");

    if (payment.status === "failed") return { status: "failed" as const, activated: false };

    const status =
      payment.status === "success" ? "success" : await payheroStatus(payment.transaction_id!);

    if (status === "success") {
      await supabaseAdmin.from("payments").update({ status: "success" }).eq("id", payment.id);
      const sub = await ensureSubscription(supabaseAdmin, { ...payment, user_id: paymentUserId });
      return { status: "success" as const, activated: true, subscription: sub };
    }
    if (status === "failed") {
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed" })
        .eq("id", payment.id)
        .eq("status", "pending");
      return { status: "failed" as const, activated: false };
    }
    return { status: "pending" as const, activated: false };
  });
