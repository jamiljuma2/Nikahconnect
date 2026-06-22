import { Link, useRouter } from "@tanstack/react-router";
import { Heart, MessageCircle, Crown, Settings, LogOut, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function Header() {
  const router = useRouter();
  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  };
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/discover" className="font-display text-2xl font-semibold tracking-tight">
          Mingle<span className="text-primary">Connect</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <NavLink to="/discover" icon={<Compass className="size-4" />} label="Discover" />
          <NavLink to="/matches" icon={<Heart className="size-4" />} label="Matches" />
          <NavLink to="/plans" icon={<Crown className="size-4" />} label="Plans" />
          <NavLink to="/settings" icon={<Settings className="size-4" />} label="Settings" />
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      activeProps={{ className: "text-primary bg-accent" }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export function MessageIcon() {
  return <MessageCircle className="size-4" />;
}
