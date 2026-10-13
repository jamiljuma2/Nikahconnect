import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

type PresenceChannel = ReturnType<typeof supabase.channel>;
type PresenceListener = (onlineIds: Set<string>) => void;

let presenceChannel: PresenceChannel | null = null;
let presenceChannelReady = false;
let activeUserId: string | null = null;
let onlineUsers = new Set<string>();
const presenceListeners = new Set<PresenceListener>();

function trackActiveUser() {
  if (!presenceChannel || !activeUserId) return;
  const now = new Date().toISOString();
  void supabase.from("profiles").update({ last_seen_at: now }).eq("id", activeUserId);
  void presenceChannel.track({ user_id: activeUserId, online_at: now });
}

function subscribeToPresence(userId: string, listener: PresenceListener) {
  activeUserId = userId;
  presenceListeners.add(listener);
  if (!presenceChannel) {
    const channel = supabase.channel("profile-activity");
    presenceChannel = channel;
    channel
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState<{ user_id?: string }>();
        const current = new Set(
          Object.values(presenceState).flatMap((metas) => metas.map((meta) => meta.user_id).filter((id): id is string => !!id)),
        );
        onlineUsers = current;
        presenceListeners.forEach((notify) => notify(current));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          presenceChannelReady = true;
          if (document.visibilityState === "visible") trackActiveUser();
        }
      });
  } else if (presenceChannelReady && document.visibilityState === "visible") {
    trackActiveUser();
  }
  listener(onlineUsers);
  return () => {
    presenceListeners.delete(listener);
    if (presenceListeners.size === 0 && activeUserId === userId) {
      const now = new Date().toISOString();
      void supabase.from("profiles").update({ last_seen_at: now }).eq("id", userId);
      activeUserId = null;
      if (presenceChannelReady) void presenceChannel?.untrack();
    }
  };
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") trackActiveUser();
    else {
      if (activeUserId) {
        const now = new Date().toISOString();
        void supabase.from("profiles").update({ last_seen_at: now }).eq("id", activeUserId);
      }
      if (presenceChannelReady) void presenceChannel?.untrack();
    }
  });
  window.addEventListener("focus", trackActiveUser);
}

export interface ProfileActivity {
  online: boolean;
  lastSeenAt: string | null;
}

export function formatLastSeen(timestamp: string | null) {
  if (!timestamp) return "Last seen recently";
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
  const watchedIdsRef = useRef<string[]>([]);
  const idsKey = useMemo(() => [...new Set(profileIds)].sort().join(","), [profileIds]);
  watchedIdsRef.current = idsKey ? idsKey.split(",") : [];

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const applySeen = (id: string, timestamp: string) => {
      if (!alive) return;
      setLastSeenById((current) => ({ ...current, [id]: timestamp }));
    };
    const onPresenceChange: PresenceListener = (presentIds) => {
      const now = new Date().toISOString();
      for (const id of watchedIdsRef.current) {
        if (onlineIdsRef.current.has(id) && !presentIds.has(id)) applySeen(id, now);
        if (presentIds.has(id)) applySeen(id, now);
      }
      onlineIdsRef.current = presentIds;
      setOnlineIds(presentIds);
    };
    const unsubscribePresence = subscribeToPresence(user.id, onPresenceChange);
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") trackActiveUser();
    }, 60_000);

    return () => {
      alive = false;
      window.clearInterval(heartbeat);
      unsubscribePresence();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !idsKey) return;
    let alive = true;
    const ids = idsKey.split(",");
    void supabase.from("public_profiles").select("id, last_seen_at").in("id", ids).then(({ data }) => {
      if (!alive) return;
      setLastSeenById((current) => ({
        ...current,
        ...Object.fromEntries((data ?? []).map((profile) => [profile.id, profile.last_seen_at])),
      }));
    });
    return () => { alive = false; };
  }, [user, idsKey]);

  return (profileId: string): ProfileActivity => ({
    online: onlineIds.has(profileId),
    lastSeenAt: lastSeenById[profileId] ?? null,
  });
}
