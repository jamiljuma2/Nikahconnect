import { Link } from "@tanstack/react-router";
import { Compass, Heart, MessageCircle } from "lucide-react";

export function BottomNav({ likesCount, unreadMessagesCount }: { likesCount: number; unreadMessagesCount: number }) {
  const items = [
    { to: "/discover", label: "Discover", icon: Compass, count: 0 },
    { to: "/likes", label: "Likes", icon: Heart, count: likesCount },
    { to: "/matches", label: "Messages", icon: MessageCircle, count: unreadMessagesCount },
  ] as const;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {items.map(({ to, label, icon: Icon, count }) => (
          <li key={label}>
            <Link
              to={to}
              className="flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium text-white/55 transition-colors hover:text-white"
              activeProps={{
                className:
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium text-[#ff3d67]",
              }}
            >
              <span className="app-nav-icon">
                <Icon className="size-5" />
                {count > 0 && <span className="app-nav-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
              </span>
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
