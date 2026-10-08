import { Link, useRouter } from "@tanstack/react-router";
import { CreditCard, LayoutDashboard, LogOut, UsersRound } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const date = new Intl.DateTimeFormat("en-KE", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Administrator";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join("");

  const signOut = async () => {
    await supabase.auth.signOut();
    await router.navigate({ to: "/" });
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/admin" className="admin-brand" aria-label="MingleConnect admin dashboard">
          <BrandLogo className="admin-brand-logo" />
        </Link>

        <div className="admin-nav-group">
          <p className="admin-nav-label">Workspace</p>
          <nav className="admin-nav" aria-label="Admin workspace">
            <Link to="/admin" activeOptions={{ exact: true }} className="admin-nav-link" activeProps={{ className: "admin-nav-link is-active" }}>
              <LayoutDashboard size={18} aria-hidden="true" />
              <span>Dashboard</span>
            </Link>
            <Link to="/admin" hash="members" className="admin-nav-link">
              <UsersRound size={18} aria-hidden="true" />
              <span>Members & roles</span>
            </Link>
          </nav>
        </div>

        <div className="admin-nav-group">
          <p className="admin-nav-label">Payments</p>
          <nav className="admin-nav" aria-label="Payment administration">
            <Link to="/admin/payments" className="admin-nav-link" activeProps={{ className: "admin-nav-link is-active" }}>
              <CreditCard size={18} aria-hidden="true" />
              <span>Payment settings</span>
            </Link>
          </nav>
        </div>

      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-mobile-brand">
            <BrandLogo className="admin-brand-logo" />
          </div>
          <div className="admin-page-heading">
            <span className="admin-eyebrow">MingleConnect · Admin</span>
            <p>{date}</p>
          </div>
          <div className="admin-topbar-user">
            <span className="admin-avatar" aria-hidden="true">{initials || "A"}</span>
            <div className="admin-user-copy">
              <span className="admin-user-name">{name}</span>
              <span className="admin-user-role">Admin</span>
            </div>
            <Button variant="ghost" size="icon" className="admin-sign-out" onClick={signOut} aria-label="Sign out">
              <LogOut size={17} />
            </Button>
          </div>
        </header>
        <main className="admin-page-content">{children}</main>
      </div>
    </div>
  );
}
