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
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
        "Idempotency-Key": data.idempotencyKey,
      },
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
      checkoutRequestID?: string;
      checkoutRequestId?: string;
      CheckoutRequestID?: string;
      checkout_request_id?: string;
      data?: {
        transactionId?: string;
        transaction_id?: string;
        id?: string;
        checkoutRequestID?: string;
        checkoutRequestId?: string;
        CheckoutRequestID?: string;
        checkout_request_id?: string;
      };
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
      body.data?.transaction_id ??
      body.data?.id ??
      body.checkoutRequestID ??
      body.checkoutRequestId ??
      body.CheckoutRequestID ??
      body.checkout_request_id ??
      body.data?.checkoutRequestID ??
      body.data?.checkoutRequestId ??
      body.data?.CheckoutRequestID ??
      body.data?.checkout_request_id ??
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

const verifyInput = z.object({ transactionId: z.string().min(4) });

/**
 * Verifies a pending payment directly with Lipana and activates the
 * subscription when the payment has succeeded. Safe to call repeatedly
 * (idempotent — one subscription per payment). This makes activation
 * automatic even when the Lipana webhook does not reach us.
 */
export const verifyAndActivatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => verifyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("user_id", context.userId)
      .eq("transaction_id", data.transactionId)
      .maybeSingle();
    if (payErr || !payment) throw new Error("Payment not found.");

    const ensureSubscription = async () => {
      const { data: existingSub } = await supabaseAdmin
        .from("subscriptions")
        .select("id, plan, remaining_reveals, is_unlimited")
        .eq("payment_id", payment.id)
        .maybeSingle();
      if (existingSub) return existingSub;

      const planId = payment.plan_type as PlanId;
      const plan = PLANS[planId];
      if (!plan) throw new Error("Unknown plan on payment.");
      const start = new Date();
      const expiry = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 30);
      const { data: inserted, error: subErr } = await supabaseAdmin
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
      if (subErr) throw new Error(subErr.message);
      return inserted;
    };

    if (payment.status === "success") {
      const sub = await ensureSubscription();
      return { status: "success" as const, activated: true, subscription: sub };
    }
    if (payment.status === "failed") {
      return { status: "failed" as const, activated: false };
    }

    const apiKey = process.env.LIPANA_SECRET_KEY;
    if (!apiKey) throw new Error("Payments are not configured.");
    if (!payment.transaction_id) return { status: "pending" as const, activated: false };

    let providerStatus: string | null = null;
    const normalizeStatus = (status: unknown) => String(status ?? "").trim().toLowerCase();
    const getStatus = (value: unknown): string | null => {
      if (!value || typeof value !== "object") return null;
      const row = value as Record<string, unknown>;
      return (
        normalizeStatus(row.status) ||
        normalizeStatus(row.paymentStatus) ||
        normalizeStatus(row.transactionStatus) ||
        normalizeStatus(row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>).status : null) ||
        null
      );
    };
    const matchesTransaction = (value: unknown) => {
      if (!value || typeof value !== "object") return false;
      const row = value as Record<string, unknown>;
      const ids = [
        row.id,
        row._id,
        row.transactionId,
        row.transaction_id,
        row.checkoutRequestID,
        row.checkoutRequestId,
        row.CheckoutRequestID,
        row.checkout_request_id,
      ].map((v) => String(v ?? ""));
      return ids.includes(payment.transaction_id);
    };
    const findMatchingTransaction = (body: unknown): unknown => {
      if (Array.isArray(body)) return body.find(matchesTransaction) ?? null;
      if (!body || typeof body !== "object") return null;
      const row = body as Record<string, unknown>;
      if (matchesTransaction(row)) return row;
      if (Array.isArray(row.data)) return row.data.find(matchesTransaction) ?? null;
      if (row.data && typeof row.data === "object") {
        const dataRow = row.data as Record<string, unknown>;
        if (matchesTransaction(dataRow)) return dataRow;
        if (Array.isArray(dataRow.transactions)) {
          return dataRow.transactions.find(matchesTransaction) ?? null;
        }
      }
      if (Array.isArray(row.transactions)) return row.transactions.find(matchesTransaction) ?? null;
      return null;
    };

    try {
      const res = await fetch(
        `https://api.lipana.dev/v1/transactions/${encodeURIComponent(payment.transaction_id)}`,
        { headers: { "x-api-key": apiKey } },
      );
      if (res.ok) {
        const body = (await res.json()) as unknown;
        providerStatus = getStatus(body);
      } else if (res.status !== 404) {
        console.error("Lipana verify failed", res.status, await res.text());
      }
    } catch (e) {
      console.error("Lipana verify error", e);
    }

    if (!providerStatus) {
      try {
        const res = await fetch("https://api.lipana.dev/v1/transactions?limit=100", {
          headers: { "x-api-key": apiKey },
        });
        if (res.ok) {
          const body = (await res.json()) as unknown;
          const match = findMatchingTransaction(body);
          providerStatus = getStatus(match);
        } else {
          console.error("Lipana transaction list failed", res.status, await res.text());
        }
      } catch (e) {
        console.error("Lipana transaction list error", e);
      }
    }

    const ok = ["success", "successful", "completed", "complete", "paid"].includes(
      providerStatus ?? "",
    );
    const bad = ["failed", "cancelled", "canceled", "expired", "timeout", "rejected"].includes(
      providerStatus ?? "",
    );

    if (ok) {
      await supabaseAdmin
        .from("payments")
        .update({ status: "success" })
        .eq("id", payment.id)
        .neq("status", "success");
      const sub = await ensureSubscription();
      return { status: "success" as const, activated: true, subscription: sub };
    }
    if (bad) {
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed" })
        .eq("id", payment.id)
        .eq("status", "pending");
      return { status: "failed" as const, activated: false };
    }
    return { status: "pending" as const, activated: false };
  });
