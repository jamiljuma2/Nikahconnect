import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { listUsersForAdmin, setUserSuspended } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — MingleConnect" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const listUsers = useServerFn(listUsersForAdmin);
  const setSuspended = useServerFn(setUserSuspended);

  const roleQ = useQuery({
    queryKey: ["myRoles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).map((r) => r.role);
    },
  });

  const isAdmin = roleQ.data?.includes("admin");

  const stats = useQuery({
    queryKey: ["admin-stats"],
    enabled: isAdmin,
    queryFn: async () => {
      const [users, matches, payments, reveals] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("matches").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "success"),
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
    enabled: isAdmin,
    queryFn: async () => {
      const { users } = await listUsers();
      return users;
    },
  });

  if (roleQ.isLoading) return <p>Loading…</p>;
  if (!isAdmin) {
    return (
      <div className="mx-auto mt-12 max-w-md text-center">
        <h2 className="font-display text-3xl font-semibold">Admins only</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have access to this area.
        </p>
      </div>
    );
  }

  const toggleSuspend = async (id: string, suspended: boolean) => {
    try {
      await setSuspended({ data: { userId: id, suspended: !suspended } });
      toast.success(!suspended ? "User suspended" : "User reinstated");
      usersQ.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold">Admin dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Users" value={stats.data?.users ?? "…"} />
        <Stat label="Matches" value={stats.data?.matches ?? "…"} />
        <Stat label="Paid plans" value={stats.data?.payments ?? "…"} />
        <Stat label="Reveals" value={stats.data?.reveals ?? "…"} />
      </div>

      <h2 className="mt-10 font-display text-2xl font-semibold">Users</h2>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(usersQ.data ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3">{u.full_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.location}</td>
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
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => toggleSuspend(u.id, u.suspended)}>
                    {u.suspended ? "Reinstate" : "Suspend"}
                  </Button>
                </td>
              </tr>
            ))}
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
