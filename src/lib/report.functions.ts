import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const submitReportInput = z.object({
  profileId: z.string().uuid(),
  reason: z.enum([
    "harassment",
    "inappropriate_content",
    "scam",
    "fake_profile",
    "underage",
    "other",
  ]),
  details: z.string().trim().max(1000).default(""),
});

export const submitProfileReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => submitReportInput.parse(data))
  .handler(async ({ data, context }) => {
    if (context.userId === data.profileId) throw new Error("You can’t report your own profile.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_reports").insert({
      reporter_id: context.userId,
      reported_user_id: data.profileId,
      reason: data.reason,
      details: data.details,
    });

    if (error?.code === "23505") {
      throw new Error("You already have an open report for this profile.");
    }
    if (error) {
      console.error("Profile report submission failed", error);
      throw new Error("Your report couldn’t be submitted. Please try again.");
    }
    return { ok: true as const };
  });
