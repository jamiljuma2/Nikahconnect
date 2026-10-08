import { Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, MessageCircle, Crown, Settings, LogOut, Compass, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/lib/use-auth";

export function Header({ likesCount, unreadMessagesCount }: { likesCount: number; unreadMessagesCount: number }) {
  const router = useRouter();
  const { user } = useAuth();
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
        <nav className="flex min-w-0 items-center gap-0.5 sm:gap-2">
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
      </div>
    </header>
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
