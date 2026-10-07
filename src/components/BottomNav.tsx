import { Link } from "@tanstack/react-router";
import { Compass, Heart, MessageCircle } from "lucide-react";

const items = [
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/matches", label: "Matches", icon: Heart },
  { to: "/matches", label: "Chats", icon: MessageCircle },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={label}>
            <Link
              to={to}
              className="flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium text-white/55 transition-colors hover:text-white"
              activeProps={{
                className:
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium text-[#ff3d67]",
              }}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
