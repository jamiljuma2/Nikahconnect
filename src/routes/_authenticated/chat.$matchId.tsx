import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHAT_DIGIT_ERROR, containsDigit } from "@/lib/digit-filter";

export const Route = createFileRoute("/_authenticated/chat/$matchId")({
  head: () => ({ meta: [{ title: "Chat — MingleConnect" }] }),
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
          setMessages((m) => [...m, payload.new as Message]);
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
    <div className="mx-auto flex max-w-2xl flex-col h-[calc(100dvh-4rem-1.25rem-4.5rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-4rem-3rem)]">
      <header className="flex items-center gap-3 border-b border-border pb-3">
        <Link to="/matches">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        {other && (
          <>
            {other.avatar_url ? (
              <img src={other.avatar_url} alt="" className="size-10 rounded-full object-cover" />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-full gradient-romance text-primary-foreground">
                {other.full_name.charAt(0)}
              </div>
            )}
            <h1 className="font-display text-xl font-semibold">{other.full_name}</h1>
          </>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            Say hello! Just remember — no numbers allowed in chat.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                <div
                  className={
                    "max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm " +
                    (mine
                      ? "gradient-romance text-primary-foreground"
                      : "bg-card text-card-foreground border border-border")
                  }
                >
                  {m.content}
                  {mine && (
                    <div className="mt-1 text-right text-[10px] opacity-70">
                      {m.read_at ? "Read" : "Sent"}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border pt-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message (no numbers)"
          maxLength={1000}
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !text.trim()}
          className="gradient-romance text-primary-foreground"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
