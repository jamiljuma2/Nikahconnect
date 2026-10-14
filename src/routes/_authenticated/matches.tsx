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
        <h2>Select a conversation</h2>
      </div>
    </section>
  );
}
