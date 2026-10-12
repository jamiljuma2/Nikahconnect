import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { InstallAppBanner } from "@/components/InstallAppBanner";
import { supabase } from "@/integrations/supabase/client";
import { userFacingErrorMessage } from "@/lib/user-facing-errors";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-semibold text-primary">404</h1>
        <h2 className="mt-4 font-display text-2xl text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          That page slipped away. Let's get you back to finding a match.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: import("@tanstack/react-router").ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error("Root route error", error);
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{userFacingErrorMessage(error, "We couldn’t load this page. Please try again.")}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MingleConnect — Meaningful Dating in Kenya" },
      { name: "theme-color", content: "#fffafb" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "MingleConnect" },
      {
        name: "description",
        content:
          "Discover, match, and chat with singles near you. Reveal real contacts on your terms with MingleConnect.",
      },
      { property: "og:title", content: "MingleConnect — Meaningful Dating in Kenya" },
      {
        property: "og:description",
        content: "Discover, match, and chat with singles near you on MingleConnect.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "MingleConnect" },
      { property: "og:image", content: "https://www.mingleconnect.co.ke/og/mingleconnect-social.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:alt", content: "MingleConnect, meaningful connections made in Kenya" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MingleConnect — Meaningful Dating in Kenya" },
      {
        name: "twitter:description",
        content: "Discover, match, and chat with singles near you on MingleConnect.",
      },
      { name: "twitter:image", content: "https://www.mingleconnect.co.ke/og/mingleconnect-social.png" },
      { name: "twitter:image:alt", content: "MingleConnect, meaningful connections made in Kenya" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // LoginForm navigates after sign-in has completed. Invalidating the
      // current route at the same time can race that navigation and briefly
      // render a router error during session establishment.
      if (event === "SIGNED_IN") return;

      if (event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void router.invalidate();
        if (event === "SIGNED_OUT") {
          queryClient.clear();
        } else {
          void queryClient.invalidateQueries();
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <InstallAppBanner />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
