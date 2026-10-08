import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, CircleDollarSign, CreditCard, Eye, Heart, MoreHorizontal, Search, ShieldCheck, ShieldOff, UserRoundCheck, UserRoundX, UsersRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  checkIsAdmin,
  listUsersForAdmin,
  setUserAdminRole,
  setUserSuspended,
} from "@/lib/admin.functions";
import { useAuth } from "@/lib/use-auth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

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
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [memberPage, setMemberPage] = useState(0);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
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

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchTerm(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => setMemberPage(0), [searchTerm]);

  const usersQ = useQuery({
    queryKey: ["admin-users", memberPage, searchTerm],
    queryFn: async () => {
      return listUsers({ data: { page: memberPage, pageSize: 25, search: searchTerm } });
    },
    placeholderData: (previous) => previous,
  });

  const toggleSuspend = async (id: string, suspended: boolean) => {
    setUpdatingUserId(id);
    try {
      await setSuspended({ data: { userId: id, suspended: !suspended } });
      toast.success(!suspended ? "User suspended" : "User reinstated");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const toggleAdmin = async (id: string, isAdmin: boolean) => {
    setUpdatingUserId(id);
    try {
      await setRole({ data: { userId: id, makeAdmin: !isAdmin } });
      toast.success(!isAdmin ? "Granted admin role" : "Revoked admin role");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUpdatingUserId(null);
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
          <p>Platform activity, member access, and payment controls.</p>
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
          <Stat icon={<CreditCard />} label="Successful payments" value={stats.data?.payments ?? "…"} detail="Confirmed transactions" />
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

      {stats.isError && <div className="admin-inline-error" role="alert">Dashboard totals couldn’t load. <button type="button" onClick={() => void stats.refetch()}>Try again</button></div>}

      <section id="members" className="admin-members-panel">
        <div className="admin-section-heading">
          <div>
            <span className="admin-eyebrow">Community</span>
            <h2>Members & roles</h2>
            <p>Search members, update admin access, or block account sign-in.</p>
          </div>
          <span className="admin-member-count">{usersQ.data?.total.toLocaleString() ?? "…"} members</span>
        </div>
        <div className="admin-members-toolbar">
          <label className="admin-member-search">
            <Search size={17} aria-hidden="true" />
            <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, location, or email" aria-label="Search members by name, location, or email" />
          </label>
          {usersQ.data && <span>Showing {usersQ.data.total === 0 ? 0 : memberPage * usersQ.data.pageSize + 1}–{Math.min((memberPage + 1) * usersQ.data.pageSize, usersQ.data.total)} of {usersQ.data.total.toLocaleString()}</span>}
        </div>
        <div className="admin-member-list" aria-label="Members and roles">
          <div className="admin-member-list-head" aria-hidden="true"><span>Member</span><span>Role</span><span>Account</span><span /></div>
          {usersQ.isError ? (
            <div className="admin-table-message" role="alert">Members couldn’t load. <button type="button" onClick={() => void usersQ.refetch()}>Try again</button></div>
          ) : usersQ.isLoading ? (
            <div className="admin-member-skeletons" aria-label="Loading members">{Array.from({ length: 5 }, (_, index) => <div key={index} />)}</div>
          ) : !usersQ.data?.users.length ? (
            <p className="admin-table-message">{searchTerm ? "No members match your search." : "No members to show yet."}</p>
          ) : (
            usersQ.data.users.map((u) => {
                const isSelf = u.id === user?.id;
                return (
                  <div className="admin-member-row" key={u.id}>
                    <div className="admin-member-identity"><span className="admin-member-avatar">{u.full_name?.trim().charAt(0).toUpperCase() || "?"}</span><span><strong>{u.full_name || "Unnamed member"}</strong><small>{u.email || u.location || "No contact details"}</small></span></div>
                    <div>
                      <span className={`admin-role-badge ${u.is_admin ? "is-admin" : ""}`}>
                        {u.is_admin ? "Admin" : "Member"}
                      </span>
                    </div>
                    <div>
                      <span className={`admin-status-badge ${u.suspended || u.deactivated_at ? "is-suspended" : ""}`}>
                        <span />{u.deactivated_at ? "Deactivated" : u.suspended ? "Suspended" : "Active"}
                      </span>
                    </div>
                    <div className="admin-member-actions">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="admin-member-menu" aria-label={`Actions for ${u.full_name || "member"}`} disabled={updatingUserId === u.id}><MoreHorizontal size={18} /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled={isSelf && u.is_admin} onSelect={() => void toggleAdmin(u.id, u.is_admin)}>{u.is_admin ? <><ShieldOff /> Revoke admin role</> : <><ShieldCheck /> Grant admin role</>}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled={isSelf} onSelect={() => void toggleSuspend(u.id, u.suspended)}>{u.suspended ? <><UserRoundCheck /> Reinstate sign-in</> : <><UserRoundX /> Suspend sign-in</>}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })
          )}
        </div>
        {usersQ.data && usersQ.data.total > usersQ.data.pageSize && <div className="admin-pagination">
          <span>Page {memberPage + 1} of {Math.ceil(usersQ.data.total / usersQ.data.pageSize)}</span>
          <div><Button variant="outline" size="sm" onClick={() => setMemberPage((page) => Math.max(0, page - 1))} disabled={memberPage === 0 || usersQ.isFetching}><ChevronLeft size={16} /> Previous</Button><Button variant="outline" size="sm" onClick={() => setMemberPage((page) => page + 1)} disabled={memberPage + 1 >= Math.ceil(usersQ.data.total / usersQ.data.pageSize) || usersQ.isFetching}>Next <ChevronRight size={16} /></Button></div>
        </div>
        }
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
