import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import {
  checkIsAdmin,
  listUsersForAdmin,
  setUserAdminRole,
  setUserSuspended,
} from "@/lib/admin.functions";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — MingleConnect" },
      { name: "description", content: "Manage MingleConnect users, activity, and platform safety." },
      { property: "og:title", content: "Admin — MingleConnect" },
      { property: "og:description", content: "Manage MingleConnect users, activity, and platform safety." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) throw redirect({ to: "/discover" });
    } catch (e) {
      if ((e as { isRedirect?: boolean }).isRedirect) throw e;
      throw redirect({ to: "/discover" });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const listUsers = useServerFn(listUsersForAdmin);
  const setSuspended = useServerFn(setUserSuspended);
  const setRole = useServerFn(setUserAdminRole);

  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, matches, payments, reveals] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("matches").select("id", { count: "exact", head: true }),
        supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("status", "success"),
        supabase.from("number_reveals").select("id", { count: "exact", head: true }),
      ]);
      return {
        users: users.count ?? 0,
        matches: matches.count ?? 0,
        payments: payments.count ?? 0,
        reveals: reveals.count ?? 0,
      };
    },
  });

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { users } = await listUsers();
      return users;
    },
  });

  const toggleSuspend = async (id: string, suspended: boolean) => {
    try {
      await setSuspended({ data: { userId: id, suspended: !suspended } });
      toast.success(!suspended ? "User suspended" : "User reinstated");
      usersQ.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggleAdmin = async (id: string, isAdmin: boolean) => {
    try {
      await setRole({ data: { userId: id, makeAdmin: !isAdmin } });
      toast.success(!isAdmin ? "Granted admin role" : "Revoked admin role");
      usersQ.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Admin dashboard</h1>
      <div className="mt-6 grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <Stat label="Users" value={stats.data?.users ?? "…"} />
        <Stat label="Matches" value={stats.data?.matches ?? "…"} />
        <Stat label="Paid plans" value={stats.data?.payments ?? "…"} />
        <Stat label="Reveals" value={stats.data?.reveals ?? "…"} />
      </div>

      <h2 className="mt-10 font-display text-2xl font-semibold">Users & roles</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Grant or revoke admin access, and suspend abusive accounts.
      </p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(usersQ.data ?? []).map((u) => {
              const isSelf = u.id === user?.id;
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3 whitespace-nowrap">{u.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.is_admin ? (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                        Admin
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        User
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.suspended ? (
                      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                        Suspended
                      </span>
                    ) : (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleAdmin(u.id, u.is_admin)}
                        disabled={isSelf && u.is_admin}
                        title={isSelf && u.is_admin ? "You can't revoke your own admin" : ""}
                      >
                        {u.is_admin ? "Revoke admin" : "Make admin"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleSuspend(u.id, u.suspended)}
                        disabled={isSelf}
                      >
                        {u.suspended ? "Reinstate" : "Suspend"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}
