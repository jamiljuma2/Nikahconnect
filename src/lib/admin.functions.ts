import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

export const getAdminDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [users, matches, payments, reveals, revenuePayments] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("matches").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("status", "success"),
      supabaseAdmin.from("number_reveals").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("payments").select("amount").eq("status", "success"),
    ]);

    const queryError = [users, matches, payments, reveals, revenuePayments].find((result) => result.error)?.error;
    if (queryError) throw new Error("Dashboard metrics couldn’t be loaded. Please try again.");

    return {
      users: users.count ?? 0,
      matches: matches.count ?? 0,
      payments: payments.count ?? 0,
      reveals: reveals.count ?? 0,
      revenue: (revenuePayments.data ?? []).reduce((sum, payment) => sum + payment.amount, 0),
    };
  });

export const listUsersForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({
    page: z.number().int().min(0).default(0),
    pageSize: z.number().int().min(1).max(50).default(25),
    search: z.string().max(100).default(""),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const term = data.search.trim().slice(0, 100);
    const { data: rows, error } = await supabaseAdmin.rpc("admin_search_members", {
      search_term: term,
      page_size: data.pageSize,
      page_offset: data.page * data.pageSize,
    });
    if (error) {
      if (error.code === "PGRST202" || error.code === "42883") {
        throw new Error("Member search is missing from the database. Apply supabase/migrations/20261008130000_admin_member_search.sql, then reload this page.");
      }
      throw new Error(error.message);
    }
    const users = (rows ?? []).map(({ total_count: _totalCount, ...user }) => user);
    return { users, total: Number(rows?.[0]?.total_count ?? 0), page: data.page, pageSize: data.pageSize };
  });

const suspendInput = z.object({
  userId: z.string().uuid(),
  suspended: z.boolean(),
});

export const setUserSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => suspendInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.userId === context.userId && data.suspended) {
      throw new Error("You can't suspend your own account.");
    }
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ suspended: data.suspended })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.suspended ? "876000h" : "none",
    });
    if (authError) {
      await supabaseAdmin.from("profiles").update({ suspended: !data.suspended }).eq("id", data.userId);
      throw new Error(`Could not update sign-in access: ${authError.message}`);
    }
    return { ok: true as const };
  });

const roleInput = z.object({
  userId: z.string().uuid(),
  makeAdmin: z.boolean(),
});

export const setUserAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => roleInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.userId === context.userId && !data.makeAdmin) {
      throw new Error("You can't remove your own admin role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.makeAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: "admin" });
      // Ignore duplicate (already admin)
      if (error && error.code !== "23505") throw new Error(error.message);
    } else {
      // Safety: don't allow removing the last remaining admin
      const { count, error: countError } = await supabaseAdmin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if (countError) throw new Error(countError.message);
      if ((count ?? 0) <= 1) {
        throw new Error("At least one admin must remain.");
      }
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });
