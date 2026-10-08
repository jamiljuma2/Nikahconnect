import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Heart, MessageCircle, Crown, Settings, LogOut, Compass, Shield, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/lib/use-auth";

export function Header({ likesCount, unreadMessagesCount }: { likesCount: number; unreadMessagesCount: number }) {
  const router = useRouter();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);
  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  };

  const roleQ = useQuery({
    queryKey: ["myRoles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      return (data ?? []).map((r) => r.role);
    },
  });
  const isAdmin = roleQ.data?.includes("admin");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
        <Link
          to="/discover"
          aria-label="MingleConnect — Discover"
          className="header-brand shrink-0"
        >
          <BrandLogo className="header-brand-logo" />
        </Link>
        <nav className="hidden min-w-0 items-center gap-0.5 sm:gap-2 md:flex">
          <NavLink to="/discover" icon={<Compass className="size-4" />} label="Discover" mobileHidden />
          <NavLink to="/likes" icon={<Heart className="size-4" />} label="Likes" notificationCount={likesCount} />
          <NavLink to="/matches" icon={<MessageCircle className="size-4" />} label="Messages" notificationCount={unreadMessagesCount} />
          <NavLink to="/plans" icon={<Crown className="size-4" />} label="Plans" />
          <NavLink to="/settings" icon={<Settings className="size-4" />} label="Settings" />
          {isAdmin && (
            <NavLink to="/admin" icon={<Shield className="size-4" />} label="Admin" />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            aria-label="Sign out"
            className="size-9 shrink-0"
          >
            <LogOut className="size-4" />
          </Button>
        </nav>
        <button
          type="button"
          className="mobile-menu-toggle md:hidden"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation-drawer"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {menuOpen && (
        <>
          <button type="button" className="mobile-menu-backdrop md:hidden" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)} />
          <aside id="mobile-navigation-drawer" className="mobile-navigation-drawer md:hidden" aria-label="Mobile navigation">
            <div className="mobile-drawer-heading"><span>Navigate</span><small>Everything you need in one place</small></div>
            <nav className="mobile-drawer-links" aria-label="Main menu" onClick={() => setMenuOpen(false)}>
              <DrawerLink to="/discover" icon={<Compass />} label="Discover" />
              <DrawerLink to="/likes" icon={<Heart />} label="Likes" count={likesCount} />
              <DrawerLink to="/matches" icon={<MessageCircle />} label="Messages" count={unreadMessagesCount} />
              <DrawerLink to="/plans" icon={<Crown />} label="Plans" />
              <DrawerLink to="/settings" icon={<Settings />} label="Settings" />
              {isAdmin && <DrawerLink to="/admin" icon={<Shield />} label="Admin" />}
            </nav>
            <button type="button" className="mobile-drawer-signout" onClick={signOut}><LogOut className="size-4" /> Sign out</button>
          </aside>
        </>
      )}
    </header>
  );
}

function DrawerLink({ to, icon, label, count = 0 }: { to: string; icon: React.ReactNode; label: string; count?: number }) {
  return (
    <Link
      to={to}
      className="mobile-drawer-link"
      activeProps={{ className: "mobile-drawer-link active" }}
    >
      <span className="mobile-drawer-link-icon">{icon}</span>
      <span>{label}</span>
      {count > 0 && <span className="mobile-drawer-count">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}

function NavLink({
  to,
  icon,
  label,
  mobileHidden,
  notificationCount = 0,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  mobileHidden?: boolean;
  notificationCount?: number;
}) {
  return (
    <Link
      to={to}
      aria-label={notificationCount > 0 ? `${label}, ${notificationCount} notifications` : label}
      className={
        "shrink-0 items-center gap-2 rounded-full px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-3 " +
        (mobileHidden ? "hidden md:inline-flex" : "inline-flex")
      }
      activeProps={{
        className:
          "inline-flex shrink-0 items-center gap-2 rounded-full bg-accent px-2.5 py-2 text-sm font-medium text-primary transition-colors sm:px-3",
      }}
    >
      <span className="app-nav-icon">
        {icon}
        {notificationCount > 0 && (
          <span className="app-nav-badge" aria-hidden="true">
            {notificationCount > 99 ? "99+" : notificationCount}
          </span>
        )}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export function MessageIcon() {
  return <MessageCircle className="size-4" />;
}
