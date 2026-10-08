import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { revealPhone, getMyBalance } from "@/lib/dating.functions";

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({
    meta: [
      { title: "Matches — MingleConnect" },
      { name: "description", content: "View your MingleConnect matches and unlock contact reveals when ready." },
      { property: "og:title", content: "Matches — MingleConnect" },
      { property: "og:description", content: "View your MingleConnect matches and unlock contact reveals when ready." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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
  const { user } = useAuth();
  const qc = useQueryClient();
  const reveal = useServerFn(revealPhone);
  const navigate = useNavigate();
  const balanceQ = useQuery({ queryKey: ["balance"], queryFn: () => getMyBalance() });

  // Load any prior reveal for this profile so the number persists and re-clicks are blocked client-side.
  const priorQ = useQuery({
    queryKey: ["reveal", user?.id, profileId],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("number_reveals")
        .select("id")
        .eq("viewer_id", user!.id)
        .eq("profile_owner_id", profileId)
        .maybeSingle();
      if (!data) return { phone: null as string | null };
      const { data: c } = await supabase
        .from("user_contacts")
        .select("phone_number")
        .eq("user_id", profileId)
        .maybeSingle();
      return { phone: c?.phone_number ?? null };
    },
  });

  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const revealedPhone = phone ?? priorQ.data?.phone ?? null;
  const sub = balanceQ.data?.subscription;
  const isUnlimited = !!sub?.is_unlimited;
  const remaining = sub?.remaining_reveals ?? 0;
  const hasPlan = !!sub && (isUnlimited || remaining > 0);

  const handle = async () => {
    if (revealedPhone || busy) return; // guard against duplicate reveals
    if (!hasPlan) {
      toast.info("Choose a plan to unlock contact reveals.");
      navigate({ to: "/plans" });
      return;
    }
    setBusy(true);
    try {
      const r = await reveal({
        data: { profileOwnerId: profileId, idempotencyKey },
      });
      setPhone(r.phone);
      if (r.alreadyRevealed) toast.info("Already revealed — no charge.");
      else toast.success("Contact unlocked!");
      qc.invalidateQueries({ queryKey: ["balance"] });
      qc.invalidateQueries({ queryKey: ["reveal", user?.id, profileId] });
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(msg);
      if (/subscription|balance|plan/i.test(msg)) navigate({ to: "/plans" });
    } finally {
      setBusy(false);
    }
  };

  if (revealedPhone) {
    return (
      <a href={`tel:${revealedPhone}`} className="inline-flex flex-1">
        <Button variant="outline" className="w-full">
          <Phone className="mr-2 size-4" />
          {revealedPhone}
        </Button>
      </a>
    );
  }

  const outOfReveals = !!sub && !isUnlimited && remaining <= 0;
  const disabled = busy || priorQ.isLoading || balanceQ.isLoading;

  return (
    <Button
      variant="outline"
      onClick={handle}
      disabled={disabled}
      className="flex-1"
      title={outOfReveals ? "No reveals left on your plan" : undefined}
    >
      <Phone className="mr-2 size-4" aria-hidden="true" />
      {busy
        ? "…"
        : outOfReveals
          ? "Upgrade to reveal"
          : isUnlimited
            ? "Reveal number"
            : sub
              ? `Reveal (${remaining} left)`
              : "Reveal number"}
    </Button>
  );
}
