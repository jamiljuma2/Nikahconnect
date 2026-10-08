import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const deleteMessageInput = z.object({ messageId: z.string().uuid() });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => deleteMessageInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: message, error: fetchError } = await supabaseAdmin
      .from("messages")
      .select("id, sender_id, deleted_at")
      .eq("id", data.messageId)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!message) throw new Error("Message not found.");
    if (message.sender_id !== context.userId) {
      throw new Error("You can only delete your own messages.");
    }
    if (message.deleted_at) return { ok: true as const };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("messages")
      .update({ content: "[Message deleted]", deleted_at: new Date().toISOString() })
      .eq("id", data.messageId)
      .eq("sender_id", context.userId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new Error("Message could not be deleted.");
    return { ok: true as const };
  });
