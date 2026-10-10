import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { AdminLayout } from "@/components/AdminLayout";
import { useAppNotifications } from "@/hooks/use-app-notifications";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return { user: data.session.user };
    } catch {
      // A brief auth network failure should not log out a user with a valid local session.
    }

    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) return { user: data.user };
    } catch {
      // Fall through to the sign-in route if neither auth check can find a session.
    }

    throw redirect({ to: "/auth", search: { mode: "login" } });
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
      <main className="mx-auto max-w-6xl px-3 py-5 pb-24 sm:px-4 sm:py-6 md:pb-6">
        <Outlet />
      </main>
      <BottomNav likesCount={notifications.likes} unreadMessagesCount={notifications.unreadMessages} />
    </div>
  );
}
