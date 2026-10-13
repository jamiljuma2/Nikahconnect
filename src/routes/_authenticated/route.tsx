import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { AdminLayout } from "@/components/AdminLayout";
import { useAppNotifications } from "@/hooks/use-app-notifications";
import { isProfileComplete } from "@/lib/profile-completion";

export const Route = createFileRoute("/_authenticated")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  ssr: false,
  beforeLoad: async ({ location }) => {
    let user = null;
    try {
      const { data } = await supabase.auth.getSession();
      user = data.session?.user ?? null;
    } catch {
      // A brief auth network failure should not log out a user with a valid local session.
    }

    if (!user) {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!error && data.user) user = data.user;
      } catch {
        // Fall through to the sign-in route if neither auth check can find a session.
      }
    }

    if (!user) throw redirect({ to: "/auth", search: { mode: "login" } });

    // Admin pages use a separate profile model and must not enter member setup.
    if (!location.pathname.startsWith("/admin")) {
      let needsSetup = false;
      try {
        const [{ data: roles, error: rolesError }, { data: profile, error: profileError }] =
          await Promise.all([
            supabase.from("user_roles").select("role").eq("user_id", user.id),
            supabase
              .from("profiles")
              .select("full_name, location, occupation, relationship_goal, interests, avatar_url")
              .eq("id", user.id)
              .maybeSingle(),
          ]);

        const isAdmin = !rolesError && (roles ?? []).some((row) => row.role === "admin");
        // Let the settings route render first; it can safely normalize a direct
        // /settings visit to /settings?setup=1 after its profile query resolves.
        needsSetup =
          !isAdmin &&
          location.pathname !== "/settings" &&
          !profileError &&
          !isProfileComplete(profile);
      } catch (error) {
        // Keep a temporary profile lookup failure from locking a signed-in user out.
        console.warn("Could not check profile completion", error);
      }

      if (needsSetup) throw redirect({ to: "/settings", search: { setup: "1" } });
    }

    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const isAdminPath = useRouterState({
    select: (state) => state.location.pathname.startsWith("/admin"),
  });

  if (isAdminPath)
    return (
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    );

  return <MemberLayout />;
}

function MemberLayout() {
  const notifications = useAppNotifications();
  const isProfileSetup = useRouterState({
    select: (state) =>
      state.location.pathname === "/settings" &&
      new URLSearchParams(state.location.searchStr).get("setup") === "1",
  });

  if (isProfileSetup) {
    return (
      <main className="min-h-screen bg-background px-3 py-5 sm:px-4 sm:py-6">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header likesCount={notifications.likes} unreadMessagesCount={notifications.unreadMessages} />
      <main className="mx-auto max-w-6xl px-3 py-5 pb-24 sm:px-4 sm:py-6 md:pb-6">
        <Outlet />
      </main>
      <BottomNav
        likesCount={notifications.likes}
        unreadMessagesCount={notifications.unreadMessages}
      />
    </div>
  );
}
