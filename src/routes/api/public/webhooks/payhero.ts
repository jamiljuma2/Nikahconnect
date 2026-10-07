import { createFileRoute } from "@tanstack/react-router";

// PayHero callbacks are unsigned, so we never trust the payload's status:
// we look up our pending payment and re-confirm with PayHero's status API.
export const Route = createFileRoute("/api/public/webhooks/payhero")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: { response?: { ExternalReference?: string; CheckoutRequestID?: string } } = {};
        try {
          payload = await request.json();
        } catch {
          return new Response("bad json", { status: 400 });
        }
        const extRef = payload.response?.ExternalReference;
        if (!extRef) return new Response("missing reference", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { payheroStatus, ensureSubscription } = await import("@/lib/payhero.server");

        const { data: payment } = await supabaseAdmin
          .from("payments")
          .select("*")
          .eq("idempotency_key", extRef)
          .maybeSingle();
        if (!payment || !payment.transaction_id) return new Response("not found", { status: 404 });

        const status =
          payment.status === "success" ? "success" : await payheroStatus(payment.transaction_id);
        if (status === "success") {
          await supabaseAdmin.from("payments").update({ status: "success" }).eq("id", payment.id);
          await ensureSubscription(supabaseAdmin, payment);
        } else if (status === "failed") {
          await supabaseAdmin
            .from("payments")
            .update({ status: "failed" })
            .eq("id", payment.id)
            .eq("status", "pending");
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
