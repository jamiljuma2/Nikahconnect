import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;
    const applySession = (s: Session | null) => {
      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      receivedAuthEvent = true;
      applySession(s);
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        // The auth listener may have delivered a newer sign-in, sign-out, or
        // recovery session while the initial storage lookup was still pending.
        if (active && !receivedAuthEvent) {
          if (error) console.warn("Could not restore the saved auth session", error);
          applySession(data.session);
        }
      })
      .catch((error: unknown) => {
        if (!active || receivedAuthEvent) return;
        console.warn("Could not restore the saved auth session", error);
        applySession(null);
      });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user, loading };
}
