import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export function useAppNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["app-notifications", user?.id] as const;

  const notificationsQ = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      const [incomingLikes, outgoingLikes, unreadMessages] = await Promise.all([
        supabase.from("likes").select("sender_id").eq("receiver_id", user!.id),
        supabase.from("likes").select("receiver_id").eq("sender_id", user!.id),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .neq("sender_id", user!.id)
          .is("read_at", null),
      ]);

      if (incomingLikes.error) throw incomingLikes.error;
      if (outgoingLikes.error) throw outgoingLikes.error;
      if (unreadMessages.error) throw unreadMessages.error;
      const alreadyLiked = new Set((outgoingLikes.data ?? []).map((like) => like.receiver_id));
      const likes = (incomingLikes.data ?? []).filter(
        (like) => !alreadyLiked.has(like.sender_id),
      ).length;
      return { likes, unreadMessages: unreadMessages.count ?? 0 };
    },
  });

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    const channel = supabase
      .channel(`app-notifications:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["app-notifications", userId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["app-notifications", userId] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  return {
    likes: notificationsQ.data?.likes ?? 0,
    unreadMessages: notificationsQ.data?.unreadMessages ?? 0,
  };
}
