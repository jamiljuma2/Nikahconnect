import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { PLANS, planForAmount } from "@/lib/plans";

export const Route = createFileRoute("/api/public/webhooks/lipana")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.LIPANA_WEBHOOK_SECRET;
        if (!secret) return new Response("not configured", { status: 500 });

        const sigHeader = (request.headers.get("x-lipana-signature") ?? "").replace(
          /^sha256=/i,
          "",
        );
        const raw = await request.text();

        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        const a = Buffer.from(sigHeader);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("invalid signature", { status: 401 });
        }

        let payload: {
          event?: string;
          data?: {
            transactionId?: string;
            transaction_id?: string;
            id?: string;
            amount?: number;
            phone?: string;
            status?: string;
            checkoutRequestID?: string;
            checkoutRequestId?: string;
            CheckoutRequestID?: string;
          };
        };
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("bad json", { status: 400 });
        }

        if (!["payment.success", "transaction.success"].includes(payload.event ?? "")) {
          return new Response("ignored", { status: 200 });
        }

        const d = payload.data ?? {};
        const transactionId =
          d.transactionId ??
          d.transaction_id ??
          d.id ??
          d.checkoutRequestID ??
          d.checkoutRequestId ??
          d.CheckoutRequestID;
        const amount = Number(d.amount);
        if (!transactionId || !amount) return new Response("missing fields", { status: 400 });

        const planId = planForAmount(amount);
        if (!planId) return new Response("unknown amount", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Find the pending payment by transaction_id.
        const { data: payment } = await supabaseAdmin
          .from("payments")
          .select("*")
          .eq("transaction_id", transactionId)
          .maybeSingle();

        if (!payment) return new Response("payment not found", { status: 404 });

        const ensureSubscription = async () => {
          const { data: existingSub } = await supabaseAdmin
            .from("subscriptions")
            .select("id")
            .eq("payment_id", payment.id)
            .maybeSingle();
          if (existingSub) return null;

          const plan = PLANS[planId];
          const start = new Date();
          const expiry = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 30); // 30 days

          const { error: subErr } = await supabaseAdmin.from("subscriptions").insert({
            user_id: payment.user_id,
            plan: planId,
            remaining_reveals: plan.unlimited ? 0 : plan.reveals,
            is_unlimited: plan.unlimited,
            start_date: start.toISOString(),
            expiry_date: expiry.toISOString(),
            payment_id: payment.id,
          });
          return subErr;
        };

        // Idempotency: if already marked paid, still ensure the reveal plan exists.
        if (payment.status === "success") {
          const subErr = await ensureSubscription();
          if (subErr) {
            console.error("sub insert", subErr);
            return new Response("sub failed", { status: 500 });
          }
          return new Response("ok", { status: 200 });
        }

        const { error: updErr } = await supabaseAdmin
          .from("payments")
          .update({ status: "success" })
          .eq("id", payment.id)
          .neq("status", "success");
        if (updErr) return new Response("update failed", { status: 500 });

        const subErr = await ensureSubscription();
        if (subErr) {
          console.error("sub insert", subErr);
          return new Response("sub failed", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
