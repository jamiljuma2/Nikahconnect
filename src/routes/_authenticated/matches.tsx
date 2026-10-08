import { createFileRoute } from "@tanstack/react-router";
import { MessageCircleHeart } from "lucide-react";
import { MessagesInbox } from "@/components/MessagesInbox";

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({
    meta: [
      { title: "Messages — MingleConnect" },
      { name: "description", content: "Keep the conversation going with your MingleConnect matches." },
      { property: "og:title", content: "Messages — MingleConnect" },
      { property: "og:description", content: "Keep the conversation going with your MingleConnect matches." },
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
        <p className="messages-eyebrow">A LITTLE SPARK CAN GO A LONG WAY</p>
        <h2>Your conversations live here</h2>
        <p>Choose a conversation to pick up where you left off, or meet someone new.</p>
      </div>
    </section>
  );
}
