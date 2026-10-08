import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

interface Conversation {
  id: string;
  otherId: string;
  name: string;
  avatar: string | null;
  preview: string;
  timestamp: string | null;
  unread: number;
}
type InboxMessage = { id: string; match_id: string; sender_id: string; content: string; created_at: string; read_at: string | null };

function shortTime(timestamp: string | null) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function MessagesInbox({ selectedMatchId }: { selectedMatchId?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const queryKey = ["message-inbox", user?.id];

  const inboxQ = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      const { data: matches, error: matchError } = await supabase
        .from("matches")
        .select("id, user_one, user_two, created_at")
        .or(`user_one.eq.${user!.id},user_two.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      if (matchError) throw matchError;
      const rows = matches ?? [];
      if (!rows.length) return [] as Conversation[];

      const otherIds = rows.map((match) => match.user_one === user!.id ? match.user_two : match.user_one);
      const matchIds = rows.map((match) => match.id);
      const [{ data: profiles }, { data: messages }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", otherIds),
        supabase.from("messages").select("id, match_id, sender_id, content, created_at, read_at")
          .in("match_id", matchIds).order("created_at", { ascending: false }),
      ]);
      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      const latestByMatch = new Map<string, InboxMessage>();
      const unreadByMatch = new Map<string, number>();
      for (const message of messages ?? []) {
        if (!latestByMatch.has(message.match_id)) latestByMatch.set(message.match_id, message);
        if (message.sender_id !== user!.id && !message.read_at) {
          unreadByMatch.set(message.match_id, (unreadByMatch.get(message.match_id) ?? 0) + 1);
        }
      }
      return rows.map((match) => {
        const otherId = match.user_one === user!.id ? match.user_two : match.user_one;
        const profile = profileMap.get(otherId);
        const latest = latestByMatch.get(match.id);
        return {
          id: match.id,
          otherId,
          name: profile?.full_name ?? "Your match",
          avatar: profile?.avatar_url ?? null,
          preview: latest?.content ?? "Start a conversation",
          timestamp: latest?.created_at ?? match.created_at,
          unread: unreadByMatch.get(match.id) ?? 0,
        };
      }).sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime());
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`inbox:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        void qc.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, qc]);

  const conversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (inboxQ.data ?? []).filter((conversation) =>
      !term || `${conversation.name} ${conversation.preview}`.toLowerCase().includes(term),
    );
  }, [inboxQ.data, search]);

  return (
    <aside className="messages-inbox">
      <div className="messages-inbox-heading">
        <div>
          <p className="messages-eyebrow">YOUR CONNECTIONS</p>
          <h1>Messages</h1>
        </div>
        <span className="messages-total">{inboxQ.data?.length ?? 0}</span>
      </div>
      <label className="messages-search">
        <Search className="size-4" aria-hidden="true" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" />
      </label>
      {inboxQ.isLoading ? (
        <div className="messages-conversation-list" aria-label="Loading conversations">
          {Array.from({ length: 5 }, (_, index) => <div className="messages-skeleton" key={index} />)}
        </div>
      ) : inboxQ.isError ? (
        <p className="messages-list-note">Your conversations couldn’t load. Please refresh.</p>
      ) : !conversations.length ? (
        <div className="messages-list-empty">
          <span><MessageCircle className="size-5" /></span>
          <p>{search ? "No conversations found" : "Your next lovely conversation starts with a match."}</p>
          {!search && <Link to="/discover">Meet someone new</Link>}
        </div>
      ) : (
        <nav className="messages-conversation-list" aria-label="Conversations">
          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              to="/chat/$matchId"
              params={{ matchId: conversation.id }}
              className={`messages-conversation${selectedMatchId === conversation.id ? " selected" : ""}`}
              aria-current={selectedMatchId === conversation.id ? "page" : undefined}
            >
              <span className="messages-avatar-wrap">
                {conversation.avatar ? <img src={conversation.avatar} alt="" className="messages-avatar" /> : <span className="messages-avatar-fallback">{conversation.name.charAt(0)}</span>}
              </span>
              <span className="messages-conversation-copy">
                <span className="messages-conversation-top"><strong>{conversation.name}</strong><time>{shortTime(conversation.timestamp)}</time></span>
                <span className="messages-conversation-bottom"><span className="messages-preview">{conversation.preview}</span>{conversation.unread > 0 && <span className="messages-unread" aria-label={`${conversation.unread} unread messages`}>{conversation.unread}</span>}</span>
              </span>
            </Link>
          ))}
        </nav>
      )}
    </aside>
  );
}
