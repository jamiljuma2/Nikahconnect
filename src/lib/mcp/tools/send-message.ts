import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function userClient(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Block sharing raw phone numbers (matches the app's chat rules).
const digitRun = /(?:\D*\d){7,}/;

export default defineTool({
  name: "send_message",
  title: "Send a chat message",
  description: "Send a chat message from the signed-in user in one of their matches.",
  inputSchema: {
    matchId: z.string().uuid().describe("The match id to send the message in."),
    content: z.string().min(1).max(2000).describe("Message body. Phone numbers are blocked."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ matchId, content }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    if (digitRun.test(content)) {
      return {
        content: [
          {
            type: "text",
            text: "Message blocked: sharing phone numbers in chat isn't allowed. Use the number-reveal flow instead.",
          },
        ],
        isError: true,
      };
    }
    const supabase = userClient(ctx);
    const { data, error } = await supabase
      .from("messages")
      .insert({ match_id: matchId, sender_id: ctx.getUserId(), content })
      .select("id, created_at")
      .single();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Message sent (id: ${data.id}).` }],
      structuredContent: { message: data },
    };
  },
});
