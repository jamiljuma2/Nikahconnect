import { createFileRoute } from "@tanstack/react-router";
import { MessageCircleHeart } from "lucide-react";
import { MessagesInbox } from "@/components/MessagesInbox";

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({
    meta: [
      { title: "Messages — NikahConnect" },
      { name: "description", content: "Continue conversations opened through mutual interest on NikahConnect." },
      { property: "og:title", content: "Messages — NikahConnect" },
      { property: "og:description", content: "Continue conversations opened through mutual interest." },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  return (
    <section className="messages-layout" aria-label="Messages">
      <MessagesInbox />
      <div className="messages-welcome">
        <div className="messages-welcome-art"><MessageCircleHeart className="size-8" strokeWidth={1.5} /></div>
        <p className="messages-eyebrow">CONVERSATIONS WITH INTENTION</p>
        <h2>Get to know one another</h2>
        <p>Choose a conversation to pick up where you left off, or meet someone new.</p>
      </div>
    </section>
  );
}
