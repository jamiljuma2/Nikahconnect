import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-3 py-5 pb-24 sm:px-4 sm:py-6 md:pb-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  ),
});
