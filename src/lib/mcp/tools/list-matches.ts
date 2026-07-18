import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function userClient(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_matches",
  title: "List my matches",
  description: "List the signed-in user's mutual matches with the other person's name and match id.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Max matches to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = userClient(ctx);
    const uid = ctx.getUserId()!;
    const { data: matches, error } = await supabase
      .from("matches")
      .select("id, user_one, user_two, created_at")
      .or(`user_one.eq.${uid},user_two.eq.${uid}`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    const otherIds = (matches ?? []).map((m) => (m.user_one === uid ? m.user_two : m.user_one));
    const { data: profiles } = otherIds.length
      ? await supabase.from("public_profiles").select("id, full_name, avatar_url, location").in("id", otherIds)
      : { data: [] as Array<{ id: string; full_name: string; avatar_url: string | null; location: string | null }> };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    const rows = (matches ?? []).map((m) => {
      const otherId = m.user_one === uid ? m.user_two : m.user_one;
      const p = byId.get(otherId);
      return {
        match_id: m.id,
        other_user_id: otherId,
        name: p?.full_name ?? null,
        location: p?.location ?? null,
        created_at: m.created_at,
      };
    });

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { matches: rows },
    };
  },
});
