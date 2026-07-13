import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Phone, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { revealPhone, getMyBalance } from "@/lib/dating.functions";

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({ meta: [{ title: "Matches — MingleConnect" }] }),
  component: MatchesPage,
});

interface MatchRow {
  id: string;
  user_one: string;
  user_two: string;
  created_at: string;
}
interface MiniProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  location: string;
}

function MatchesPage() {
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["matches", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: matches } = await supabase
        .from("matches")
        .select("*")
        .or(`user_one.eq.${user!.id},user_two.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      const m = (matches ?? []) as MatchRow[];
      const otherIds = m.map((r) => (r.user_one === user!.id ? r.user_two : r.user_one));
      if (otherIds.length === 0) return { matches: m, profiles: {} as Record<string, MiniProfile> };
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, location")
        .in("id", otherIds);
      const map: Record<string, MiniProfile> = {};
      (profiles ?? []).forEach((p) => (map[p.id] = p as MiniProfile));
      return { matches: m, profiles: map };
    },
  });

  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  const { matches = [], profiles = {} } = q.data ?? {};

  if (matches.length === 0) {
    return (
      <div className="mx-auto mt-12 max-w-md text-center">
        <h2 className="font-display text-3xl font-semibold">No matches yet</h2>
        <p className="mt-2 text-muted-foreground">Keep swiping — the magic happens when it's mutual.</p>
        <Link to="/discover">
          <Button className="mt-6 gradient-romance text-primary-foreground">Discover people</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold">Your matches</h1>
      <p className="mt-1 text-sm text-muted-foreground">{matches.length} mutual sparks ✨</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {matches.map((m) => {
          const otherId = m.user_one === user!.id ? m.user_two : m.user_one;
          const p = profiles[otherId];
          if (!p) return null;
          return (
            <li key={m.id} className="rounded-3xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center gap-4">
                <Avatar profile={p} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-xl font-semibold">{p.full_name}</p>
                  <p className="truncate text-sm text-muted-foreground">{p.location}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Link to="/chat/$matchId" params={{ matchId: m.id }} className="flex-1">
                  <Button className="w-full gradient-romance text-primary-foreground">Chat</Button>
                </Link>
                <RevealButton profileId={p.id} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Avatar({ profile }: { profile: MiniProfile }) {
  return profile.avatar_url ? (
    <img
      src={profile.avatar_url}
      alt=""
      className="size-14 rounded-full object-cover ring-2 ring-primary/20"
    />
  ) : (
    <div className="flex size-14 items-center justify-center rounded-full gradient-romance font-display text-xl text-primary-foreground">
      {profile.full_name.charAt(0)}
    </div>
  );
}

function RevealButton({ profileId }: { profileId: string }) {
  const reveal = useServerFn(revealPhone);
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Stable per-button idempotency key — retries return the same reveal.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const handle = async () => {
    setBusy(true);
    try {
      const r = await reveal({
        data: { profileOwnerId: profileId, idempotencyKey },
      });
      setPhone(r.phone);
      if (r.alreadyRevealed) toast.info("Already revealed — no charge.");
      else toast.success("Contact unlocked!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (phone) {
    return (
      <a href={`tel:${phone}`} className="inline-flex flex-1">
        <Button variant="outline" className="w-full">
          <Phone className="mr-2 size-4" />
          {phone}
        </Button>
      </a>
    );
  }
  return (
    <Button variant="outline" onClick={handle} disabled={busy} className="flex-1">
      <Lock className="mr-2 size-4" />
      {busy ? "…" : "Reveal number"}
    </Button>
  );
}
