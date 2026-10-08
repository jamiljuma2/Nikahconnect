import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const revealInput = z.object({
  profileOwnerId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(100).optional(),
});

const REVEAL_ERROR_MESSAGES: Record<string, string> = {
  self_reveal: "You don't need to reveal your own number.",
  cooldown: "Please wait a moment before revealing another number.",
  rate_minute: "Too many reveals in the last minute. Slow down and try again shortly.",
  rate_day: "You've hit the daily reveal limit. Try again tomorrow.",
  no_active_paid_subscription:
    "You need an active subscription tied to a successful payment to reveal contacts.",
  no_balance: "Your reveal balance is exhausted. Purchase a subscription plan to continue.",
  invalid_input: "Invalid request.",
};

export const revealPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => revealInput.parse(d))
  .handler(async ({ data, context }) => {
    const viewerId = context.userId;
    if (viewerId === data.profileOwnerId) {
      throw new Error(REVEAL_ERROR_MESSAGES.self_reveal);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Atomic: cooldowns + payment-linked subscription + decrement + insert reveal
    const { data: rpc, error: rpcErr } = await supabaseAdmin.rpc("consume_reveal", {
      _viewer: viewerId,
      _owner: data.profileOwnerId,
      _idempotency_key: data.idempotencyKey,
    });

    if (rpcErr) {
      const code = rpcErr.message?.match(/[a-z_]+/)?.[0] ?? "";
      const friendly = REVEAL_ERROR_MESSAGES[code];
      if (friendly) throw new Error(friendly);
      console.error("consume_reveal failed", rpcErr);
      throw new Error("Could not reveal number. Try again.");
    }

    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    const alreadyRevealed = !!row?.already_revealed;

    const [{ data: profile, error: profErr }, { data: contact, error: contactErr }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("id", data.profileOwnerId)
          .single(),
        supabaseAdmin
          .from("user_contacts")
          .select("phone_number")
          .eq("user_id", data.profileOwnerId)
          .single(),
      ]);

    if (profErr || contactErr) throw new Error("Contact info not found");

    return {
      phone: contact.phone_number,
      name: profile.full_name,
      alreadyRevealed,
    };
  });

export const getMyBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subscriptions, error: subscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", context.userId)
      .order("start_date", { ascending: false })
      .limit(100);
    if (subscriptionError) throw new Error(subscriptionError.message);
    const activeSubscriptions = (subscriptions ?? []).filter(
      (sub) => sub.payment_id && (!sub.expiry_date || new Date(sub.expiry_date) > new Date()),
    );
    const paymentIds = activeSubscriptions.map((sub) => sub.payment_id!);
    if (!paymentIds.length) return { subscription: null };

    const { data: payments, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("id")
      .in("id", paymentIds)
      .eq("user_id", context.userId)
      .eq("status", "success");
    if (paymentError) throw new Error(paymentError.message);

    const successfulPayments = new Set((payments ?? []).map((payment) => payment.id));
    const subscription = activeSubscriptions.find(
      (sub) =>
        successfulPayments.has(sub.payment_id!) &&
        (sub.is_unlimited || sub.remaining_reveals > 0),
    );
    return { subscription: subscription ?? null };
  });
