import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Reply, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { CHAT_DIGIT_ERROR, containsDigit } from "@/lib/digit-filter";
import { MessagesInbox } from "@/components/MessagesInbox";
import { deleteMessage } from "@/lib/messaging.functions";
import { formatLastSeen, type ProfileActivity } from "@/hooks/use-message-activity";
import { notifyUserError } from "@/lib/user-facing-errors";
import { ReportProfileDialog } from "@/components/ReportProfileDialog";

export const Route = createFileRoute("/_authenticated/chat/$matchId")({
  head: () => ({
    meta: [
      { title: "Chat — NikahConnect" },
      {
        name: "description",
        content: "Continue a private, marriage-minded conversation on NikahConnect.",
      },
      { property: "og:title", content: "Chat — NikahConnect" },
      { property: "og:description", content: "Continue a private conversation on NikahConnect." },
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
  reply_to_message_id: string | null;
  deleted_at: string | null;
  reply?: ReplyPreview | null;
}

interface ReplyPreview {
  id: string;
  sender_id: string;
  content: string;
  deleted_at: string | null;
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
  const [otherActivity, setOtherActivity] = useState<ProfileActivity>({
    online: false,
    lastSeenAt: null,
  });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const deleteMessageFn = useServerFn(deleteMessage);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleProfileActivity = useCallback(
    (activity: ProfileActivity) => setOtherActivity(activity),
    [],
  );

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
        .from("public_profiles")
        .select("id, full_name, avatar_url")
        .eq("id", otherId)
        .single();
      if (alive && p) setOther(p as MiniProfile);

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });
      if (alive) setMessages(await attachReplyPreviews((msgs ?? []) as Message[]));

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
        async (payload) => {
          const message = payload.new as Message;
          const [withReply] = await attachReplyPreviews([message]);
          if (!alive) return;
          setMessages((current) =>
            current.some((item) => item.id === message.id) ? current : [...current, withReply],
          );
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
        async (payload) => {
          const updated = payload.new as Message;
          const [withReply] = await attachReplyPreviews([updated]);
          setMessages((current) =>
            current.map((item) =>
              item.id === updated.id
                ? { ...withReply, reply: item.reply }
                : item.reply_to_message_id === updated.id
                  ? {
                      ...item,
                      reply: {
                        id: updated.id,
                        sender_id: updated.sender_id,
                        content: updated.content,
                        deleted_at: updated.deleted_at,
                      },
                    }
                  : item,
            ),
          );
          setReplyTarget((current) =>
            current?.id === updated.id ? { ...current, ...updated } : current,
          );
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [matchId, user]);

  async function attachReplyPreviews(rows: Message[]): Promise<Message[]> {
    const ids = [
      ...new Set(
        rows.map((message) => message.reply_to_message_id).filter((id): id is string => !!id),
      ),
    ];
    if (!ids.length) return rows.map((message) => ({ ...message, reply: null }));
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, content, deleted_at")
      .in("id", ids);
    const previews = new Map((data ?? []).map((item) => [item.id, item as ReplyPreview]));
    return rows.map((message) => ({
      ...message,
      reply: previews.get(message.reply_to_message_id!) ?? null,
    }));
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateChatViewport = () => {
      document.documentElement.style.setProperty("--chat-visual-height", `${viewport.height}px`);
      document.documentElement.style.setProperty("--chat-visual-offset", `${viewport.offsetTop}px`);
    };
    updateChatViewport();
    viewport.addEventListener("resize", updateChatViewport);
    viewport.addEventListener("scroll", updateChatViewport);
    return () => {
      viewport.removeEventListener("resize", updateChatViewport);
      viewport.removeEventListener("scroll", updateChatViewport);
      document.documentElement.style.removeProperty("--chat-visual-height");
      document.documentElement.style.removeProperty("--chat-visual-offset");
    };
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !user) return;
    if (containsDigit(content)) {
      toast.error(CHAT_DIGIT_ERROR);
      return;
    }
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      match_id: matchId,
      sender_id: user.id,
      content,
      reply_to_message_id: replyTarget?.id ?? null,
    });
    setSending(false);
    if (error) {
      if (error.message.toLowerCase().includes("messages_no_digits")) toast.error(CHAT_DIGIT_ERROR);
      else notifyUserError(error, "We couldn’t send your message. Please try again.");
      return;
    }
    setText("");
    setReplyTarget(null);
  };

  const removeMessage = async (message: Message) => {
    if (message.deleted_at || deletingId) return;
    if (
      !window.confirm(
        "Delete this message for everyone? The conversation will show that it was deleted.",
      )
    )
      return;
    setDeletingId(message.id);
    try {
      await deleteMessageFn({ data: { messageId: message.id } });
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? { ...item, content: "[Message deleted]", deleted_at: new Date().toISOString() }
            : item.reply_to_message_id === message.id
              ? {
                  ...item,
                  reply: {
                    id: message.id,
                    sender_id: message.sender_id,
                    content: "[Message deleted]",
                    deleted_at: new Date().toISOString(),
                  },
                }
              : item,
        ),
      );
      setReplyTarget((current) =>
        current?.id === message.id
          ? { ...current, content: "[Message deleted]", deleted_at: new Date().toISOString() }
          : current,
      );
    } catch (error) {
      notifyUserError(error, "We couldn’t delete that message. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="messages-layout messages-chat-layout has-active-chat" aria-label="Messages">
      <MessagesInbox selectedMatchId={matchId} onProfileActivity={handleProfileActivity} />
      <div className="messages-chat-panel">
        <header className="messages-chat-header">
          <Link to="/matches" className="messages-back" aria-label="Back to messages">
            <ArrowLeft className="size-5" />
          </Link>
          {other ? (
            <>
              {other.avatar_url ? (
                <img src={other.avatar_url} alt="" className="messages-header-avatar" />
              ) : (
                <span className="messages-header-fallback">{other.full_name.charAt(0)}</span>
              )}
              <div className="min-w-0">
                <h1>{other.full_name}</h1>
                <p
                  className={`messages-header-activity${otherActivity.online ? " is-online" : ""}`}
                >
                  <span aria-hidden="true" />
                  {otherActivity.online ? "Online" : formatLastSeen(otherActivity.lastSeenAt)}
                </p>
              </div>
              <ReportProfileDialog profileId={other.id} profileName={other.full_name} />
            </>
          ) : (
            <div className="messages-header-skeleton" />
          )}
        </header>

        <div ref={scrollRef} className="messages-thread">
          {messages.length === 0 ? (
            <div className="messages-first-note">
              <span aria-hidden="true">✦</span>
              <p>Start by learning what matters to one another.</p>
              <div className="messages-starter-list" aria-label="Conversation starter ideas">
                {[
                  "What are you hoping to build in marriage?",
                  "Which values shape your daily life?",
                  "How would you like family to be involved?",
                  "What future goals matter most to you?",
                  "What feels important when discussing finances?",
                  "What helps you feel heard in a conversation?",
                  "What does religious practice mean to you?",
                ].map((prompt) => (
                  <button key={prompt} type="button" onClick={() => setText(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => {
              const mine = message.sender_id === user?.id;
              const currentDay = new Date(message.created_at).toDateString();
              const previousDay =
                index > 0 ? new Date(messages[index - 1].created_at).toDateString() : null;
              return (
                <div key={message.id}>
                  {currentDay !== previousDay && (
                    <div className="messages-day-divider">
                      <span>
                        {new Date(message.created_at).toLocaleDateString([], {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  <div className={`messages-bubble-row${mine ? " mine" : ""}`}>
                    <div className="messages-bubble-actions">
                      {!message.deleted_at && (
                        <button
                          type="button"
                          onClick={() => setReplyTarget(message)}
                          aria-label="Reply to message"
                          title="Reply"
                        >
                          <Reply className="size-4" />
                        </button>
                      )}
                      {mine && !message.deleted_at && (
                        <button
                          type="button"
                          onClick={() => void removeMessage(message)}
                          disabled={deletingId === message.id}
                          aria-label="Delete message"
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                    <div
                      className={`messages-bubble${mine ? " sent" : " received"}${message.deleted_at ? " deleted" : ""}`}
                    >
                      {message.reply_to_message_id && message.reply && (
                        <div className="messages-reply-quote">
                          <strong>
                            {message.reply.sender_id === user?.id
                              ? "You"
                              : (other?.full_name ?? "Your match")}
                          </strong>
                          <span>
                            {message.reply.deleted_at
                              ? "This message was deleted"
                              : message.reply.content}
                          </span>
                        </div>
                      )}
                      <p>{message.deleted_at ? "This message was deleted" : message.content}</p>
                      <div className="messages-bubble-meta">
                        <time>
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                        {mine && <span>{message.read_at ? "Read" : "Sent"}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {replyTarget && (
          <div className="messages-replying">
            <div>
              <strong>
                Replying to{" "}
                {replyTarget.sender_id === user?.id
                  ? "yourself"
                  : (other?.full_name ?? "your match")}
              </strong>
              <span>
                {replyTarget.deleted_at ? "This message was deleted" : replyTarget.content}
              </span>
            </div>
            <button type="button" onClick={() => setReplyTarget(null)} aria-label="Cancel reply">
              <X className="size-4" />
            </button>
          </div>
        )}
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
            placeholder="Write a thoughtful message…"
            aria-label="Write a message"
            maxLength={1000}
            rows={1}
          />
          <button type="submit" aria-label="Send message" disabled={sending || !text.trim()}>
            <Send className="size-4" />
          </button>
        </form>
        <p className="messages-composer-hint">Press Enter to send · No numbers allowed</p>
      </div>
    </section>
  );
}
