import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CircleDollarSign, CreditCard, Eye, Heart, UsersRound } from "lucide-react";
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
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const listUsers = useServerFn(listUsersForAdmin);
  const setSuspended = useServerFn(setUserSuspended);
  const setRole = useServerFn(setUserAdminRole);

  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, matches, payments, reveals, revenue] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("matches").select("id", { count: "exact", head: true }),
        supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("status", "success"),
        supabase.from("number_reveals").select("id", { count: "exact", head: true }),
        supabase.rpc("admin_collected_revenue"),
      ]);
      const queryError = [users, matches, payments, reveals, revenue].find((result) => result.error)?.error;
      if (queryError) throw new Error(queryError.message);
      return {
        users: users.count ?? 0,
        matches: matches.count ?? 0,
        payments: payments.count ?? 0,
        reveals: reveals.count ?? 0,
        revenue: Number(revenue.data ?? 0),
      };
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`admin-revenue-${user?.id ?? "dashboard"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => void queryClient.invalidateQueries({ queryKey: ["admin-stats"] }),
      )
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));
    return () => {
      setRealtimeConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

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

  const revenueLabel = stats.data
    ? new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        maximumFractionDigits: 0,
      }).format(stats.data.revenue)
    : "…";

  return (
    <div className="admin-dashboard">
      <div className="admin-title-row">
        <div>
          <span className="admin-eyebrow">Overview</span>
          <h1>Admin dashboard</h1>
          <p>Manage members, review platform activity, and keep MingleConnect running smoothly.</p>
        </div>
        <Link to="/admin/payments" className="admin-outline-action">
          <CreditCard size={17} aria-hidden="true" />
          <span>Payment settings</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      <div className="admin-overview-grid">
        <section className="admin-stat-grid" aria-label="Platform statistics">
          <Stat icon={<UsersRound />} label="Members" value={stats.data?.users ?? "…"} detail="Registered profiles" />
          <Stat icon={<Heart />} label="Matches" value={stats.data?.matches ?? "…"} detail="Connections made" />
          <Stat icon={<CreditCard />} label="Paid plans" value={stats.data?.payments ?? "…"} detail="Successful payments" />
          <Stat icon={<Eye />} label="Contact reveals" value={stats.data?.reveals ?? "…"} detail="Numbers revealed" />
        </section>

        <aside className="admin-revenue-card">
          <div className="admin-revenue-topline">
            <span className="admin-revenue-icon"><CircleDollarSign size={20} /></span>
            <span className={`admin-live-status ${realtimeConnected ? "is-live" : ""}`}>
              <span />{realtimeConnected ? "Live" : "Connecting"}
            </span>
          </div>
          <p className="admin-revenue-label">Revenue collected</p>
          <p className="admin-revenue-value">{revenueLabel}</p>
          <p className="admin-revenue-note">Confirmed M-Pesa payments across all paid plans.</p>
          <div className="admin-revenue-footer">
            <span>{stats.data?.payments ?? "…"} successful payments</span>
            <span className="admin-revenue-live-copy">Updates live</span>
          </div>
        </aside>
      </div>

      <section id="members" className="admin-members-panel">
        <div className="admin-section-heading">
          <div>
            <span className="admin-eyebrow">Community</span>
            <h2>Members & roles</h2>
            <p>Grant or revoke admin access, and suspend or reinstate accounts.</p>
          </div>
          <span className="admin-member-count">{usersQ.data?.length ?? "…"} shown</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th className="admin-actions-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(usersQ.data ?? []).map((u) => {
                const isSelf = u.id === user?.id;
                return (
                  <tr key={u.id}>
                    <td className="admin-member-name">{u.full_name || "Unnamed member"}</td>
                    <td className="admin-member-email">{u.email}</td>
                    <td>
                      <span className={`admin-role-badge ${u.is_admin ? "is-admin" : ""}`}>
                        {u.is_admin ? "Admin" : "Member"}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-status-badge ${u.suspended ? "is-suspended" : ""}`}>
                        <span />{u.suspended ? "Suspended" : "Active"}
                      </span>
                    </td>
                    <td>
                      <div className="admin-row-actions">
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
          {usersQ.isLoading && <p className="admin-table-message">Loading members…</p>}
          {!usersQ.isLoading && !usersQ.data?.length && (
            <p className="admin-table-message">No members to show yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number | string; detail: string }) {
  return (
    <div className="admin-stat-card">
      <span className="admin-stat-icon">{icon}</span>
      <p className="admin-stat-label">{label}</p>
      <p className="admin-stat-value">{value}</p>
      <p className="admin-stat-detail">{detail}</p>
    </div>
  );
}
