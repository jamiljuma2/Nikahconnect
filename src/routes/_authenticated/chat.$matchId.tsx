import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { CHAT_DIGIT_ERROR, containsDigit } from "@/lib/digit-filter";
import { MessagesInbox } from "@/components/MessagesInbox";

export const Route = createFileRoute("/_authenticated/chat/$matchId")({
  head: () => ({
    meta: [
      { title: "Chat — MingleConnect" },
      { name: "description", content: "Continue a private MingleConnect conversation with your match." },
      { property: "og:title", content: "Chat — MingleConnect" },
      { property: "og:description", content: "Continue a private MingleConnect conversation with your match." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface MiniProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

function ChatPage() {
  const { matchId } = Route.useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<MiniProfile | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load match + messages + subscribe
  useEffect(() => {
    if (!user) return;
    let alive = true;

    (async () => {
      const { data: match } = await supabase
        .from("matches")
        .select("user_one, user_two")
        .eq("id", matchId)
        .single();
      if (!alive || !match) return;
      const otherId = match.user_one === user.id ? match.user_two : match.user_one;
      const { data: p } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", otherId)
        .single();
      if (alive && p) setOther(p as MiniProfile);

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });
      if (alive) setMessages((msgs ?? []) as Message[]);

      // Mark unread messages from other as read
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("match_id", matchId)
        .neq("sender_id", user.id)
        .is("read_at", null);
    })();

    const channel = supabase
      .channel(`chat:${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const message = payload.new as Message;
          setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
          if (message.sender_id !== user.id && !message.read_at) {
            void supabase
              .from("messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", message.id)
              .is("read_at", null);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => {
          setMessages((m) => m.map((x) => (x.id === (payload.new as Message).id ? (payload.new as Message) : x)));
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [matchId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !user) return;
    if (containsDigit(content)) {
      toast.error(CHAT_DIGIT_ERROR);
      return;
    }
    setSending(true);
    const { error } = await supabase
      .from("messages")
      .insert({ match_id: matchId, sender_id: user.id, content });
    setSending(false);
    if (error) {
      if (error.message.toLowerCase().includes("messages_no_digits"))
        toast.error(CHAT_DIGIT_ERROR);
      else toast.error(error.message);
      return;
    }
    setText("");
  };

  return (
    <section className="messages-layout messages-chat-layout has-active-chat" aria-label="Messages">
      <MessagesInbox selectedMatchId={matchId} />
      <div className="messages-chat-panel">
        <header className="messages-chat-header">
          <Link to="/matches" className="messages-back" aria-label="Back to messages">
            <ArrowLeft className="size-5" />
          </Link>
          {other ? (
            <>
              {other.avatar_url ? <img src={other.avatar_url} alt="" className="messages-header-avatar" /> : <span className="messages-header-fallback">{other.full_name.charAt(0)}</span>}
              <div className="min-w-0"><h1>{other.full_name}</h1><p>Your match</p></div>
            </>
          ) : <div className="messages-header-skeleton" />}
        </header>

        <div ref={scrollRef} className="messages-thread">
          {messages.length === 0 ? (
            <div className="messages-first-note"><span>✦</span><p>Say hello and see where the conversation goes.</p><small>Just remember — no numbers allowed in chat.</small></div>
          ) : (
            messages.map((message, index) => {
              const mine = message.sender_id === user?.id;
              const currentDay = new Date(message.created_at).toDateString();
              const previousDay = index > 0 ? new Date(messages[index - 1].created_at).toDateString() : null;
              return (
                <div key={message.id}>
                  {currentDay !== previousDay && <div className="messages-day-divider"><span>{new Date(message.created_at).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</span></div>}
                  <div className={`messages-bubble-row${mine ? " mine" : ""}`}>
                    <div className={`messages-bubble${mine ? " sent" : " received"}`}>
                      <p>{message.content}</p>
                      <div className="messages-bubble-meta">
                        <time>{new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
                        {mine && <span>{message.read_at ? "Read" : "Sent"}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={send} className="messages-composer">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Write a message…"
            aria-label="Write a message"
            maxLength={1000}
            rows={1}
          />
          <button type="submit" aria-label="Send message" disabled={sending || !text.trim()}>
            <Send className="size-4" />
          </button>
        </form>
        <p className="messages-composer-hint">Press Enter to send · No numbers in chat</p>
      </div>
    </section>
  );
}
