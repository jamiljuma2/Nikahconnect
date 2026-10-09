import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export interface ProfileActivity {
  online: boolean;
  lastSeenAt: string | null;
}

export function formatLastSeen(timestamp: string | null) {
  if (!timestamp) return "Activity unavailable";
  const elapsed = Math.max(0, Date.now() - new Date(timestamp).getTime());
  if (elapsed < 60_000) return "Last seen just now";
  if (elapsed < 60 * 60_000) return `Last seen ${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 24 * 60 * 60_000) return `Last seen ${Math.floor(elapsed / (60 * 60_000))}h ago`;
  return `Last seen ${new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

export function useMessageActivity(profileIds: string[]) {
  const { user } = useAuth();
  const [lastSeenById, setLastSeenById] = useState<Record<string, string | null>>({});
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());
  const onlineIdsRef = useRef<Set<string>>(new Set());
  const idsKey = useMemo(() => [...new Set(profileIds)].sort().join(","), [profileIds]);

  useEffect(() => {
    if (!user) return;
    const ids = idsKey ? idsKey.split(",") : [];
    let alive = true;
    const applySeen = (id: string, timestamp: string) => {
      if (!alive) return;
      setLastSeenById((current) => ({ ...current, [id]: timestamp }));
    };
    const saveLastSeen = (timestamp: string) => {
      applySeen(user.id, timestamp);
      void supabase.from("profiles").update({ last_seen_at: timestamp }).eq("id", user.id);
    };

    if (ids.length) {
      void supabase.from("profiles").select("id, last_seen_at").in("id", ids).then(({ data }) => {
        if (!alive) return;
        setLastSeenById((current) => ({
          ...current,
          ...Object.fromEntries((data ?? []).map((profile) => [profile.id, profile.last_seen_at])),
        }));
      });
    }

    const channel = supabase
      .channel("profile-activity", { config: { presence: { key: user.id } } })
      .on("presence", { event: "sync" }, () => {
        const presentIds = new Set(Object.keys(channel.presenceState()));
        const now = new Date().toISOString();
        for (const id of ids) {
          if (onlineIdsRef.current.has(id) && !presentIds.has(id)) applySeen(id, now);
        }
        onlineIdsRef.current = presentIds;
        setOnlineIds(presentIds);
        for (const id of ids) {
          if (presentIds.has(id)) applySeen(id, now);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && document.visibilityState === "visible") {
          const now = new Date().toISOString();
          saveLastSeen(now);
          void channel.track({ user_id: user.id, online_at: now });
        }
      });

    const goOnline = () => {
      if (document.visibilityState !== "visible") return;
      const now = new Date().toISOString();
      saveLastSeen(now);
      void channel.track({ user_id: user.id, online_at: now });
    };
    const goOffline = () => {
      if (document.visibilityState === "visible") return;
      saveLastSeen(new Date().toISOString());
      void channel.untrack();
    };
    document.addEventListener("visibilitychange", goOffline);
    window.addEventListener("focus", goOnline);
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") saveLastSeen(new Date().toISOString());
    }, 60_000);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", goOffline);
      window.removeEventListener("focus", goOnline);
      window.clearInterval(heartbeat);
      saveLastSeen(new Date().toISOString());
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [user, idsKey]);

  return (profileId: string): ProfileActivity => ({
    online: onlineIds.has(profileId),
    lastSeenAt: lastSeenById[profileId] ?? null,
  });
}
