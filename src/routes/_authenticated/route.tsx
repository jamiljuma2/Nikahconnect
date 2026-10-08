import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { AdminLayout } from "@/components/AdminLayout";
import { useAppNotifications } from "@/hooks/use-app-notifications";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "login" } });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const isAdminPath = useRouterState({
    select: (state) => state.location.pathname.startsWith("/admin"),
  });

  if (isAdminPath) return <AdminLayout><Outlet /></AdminLayout>;

  return <MemberLayout />;
}

function MemberLayout() {
  const notifications = useAppNotifications();
  return (
    <div className="min-h-screen bg-background">
      <Header likesCount={notifications.likes} unreadMessagesCount={notifications.unreadMessages} />
      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
