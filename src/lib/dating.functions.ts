import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const revealInput = z.object({ profileOwnerId: z.string().uuid() });

export const revealPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => revealInput.parse(d))
  .handler(async ({ data, context }) => {
    const viewerId = context.userId;
    if (viewerId === data.profileOwnerId) {
      throw new Error("You don't need to reveal your own number.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. If already revealed, return phone immediately (no charge).
    const { data: existing } = await supabaseAdmin
      .from("number_reveals")
      .select("id")
      .eq("viewer_id", viewerId)
      .eq("profile_owner_id", data.profileOwnerId)
      .maybeSingle();

    const fetchPhone = async () => {
      const { data: profile, error: profErr } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", data.profileOwnerId)
        .single();
      if (profErr) throw new Error("Profile not found");
      const { data: contact, error: contactErr } = await supabaseAdmin
        .from("user_contacts")
        .select("phone_number")
        .eq("user_id", data.profileOwnerId)
        .single();
      if (contactErr) throw new Error("Contact info not found");
      return { phone_number: contact.phone_number, full_name: profile.full_name };
    };

    if (existing) {
      const p = await fetchPhone();
      return { phone: p.phone_number, name: p.full_name, alreadyRevealed: true as const };
    }

    // 2. Find latest active subscription.
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", viewerId)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      throw new Error("You don't have an active subscription. Purchase a plan to reveal contacts.");
    }
    if (!sub.is_unlimited && sub.remaining_reveals <= 0) {
      throw new Error(
        "Your reveal balance is exhausted. Purchase a subscription plan to continue.",
      );
    }

    // 3. Decrement (if not unlimited) and record reveal atomically-ish.
    if (!sub.is_unlimited) {
      const { error: updErr } = await supabaseAdmin
        .from("subscriptions")
        .update({ remaining_reveals: sub.remaining_reveals - 1 })
        .eq("id", sub.id)
        .gt("remaining_reveals", 0);
      if (updErr) throw new Error("Could not deduct reveal credit. Try again.");
    }

    const { error: insErr } = await supabaseAdmin
      .from("number_reveals")
      .insert({ viewer_id: viewerId, profile_owner_id: data.profileOwnerId });

    if (insErr) {
      // Likely a race: another reveal was inserted. Refund credit.
      if (!sub.is_unlimited) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ remaining_reveals: sub.remaining_reveals })
          .eq("id", sub.id);
      }
      throw new Error("Could not record reveal. Try again.");
    }

    const p = await fetchPhone();
    return { phone: p.phone_number, name: p.full_name, alreadyRevealed: false as const };
  });

export const getMyBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", context.userId)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { subscription: sub };
  });
