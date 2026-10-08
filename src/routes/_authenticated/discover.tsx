import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Heart, Loader2, MapPin, Phone, Search, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { revealPhone } from "@/lib/dating.functions";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({
    meta: [
      { title: "Discover — MingleConnect" },
      { name: "description", content: "Swipe through MingleConnect profiles and find meaningful matches nearby." },
      { property: "og:title", content: "Discover — MingleConnect" },
      { property: "og:description", content: "Swipe through MingleConnect profiles and find meaningful matches nearby." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Discover,
});

interface Profile {
  id: string;
  full_name: string;
  age: number;
  gender: string;
  location: string;
  bio: string;
  avatar_url: string | null;
  interests: string[];
  occupation: string;
  relationship_goal: string;
}

const PAGE_SIZE = 20;
const PREFETCH_THRESHOLD = 5; // load next page when this many remain

function Discover() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [passed, setPassed] = useState<string[]>([]);
  const [likedLocal, setLikedLocal] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "female" | "male" | "other">("all");

  const profilesQ = useInfiniteQuery<Profile[], Error, { pages: Profile[][]; pageParams: number[] }, readonly unknown[], number>({
    queryKey: ["discover", user?.id],
    enabled: !!user,
    initialPageParam: 0,
    getNextPageParam: (last, all) =>
      last.length < PAGE_SIZE ? undefined : all.length * PAGE_SIZE,
    queryFn: async ({ pageParam }) => {
      const { data: liked } = await supabase
        .from("likes")
        .select("receiver_id")
        .eq("sender_id", user!.id);
      const excludeIds = [user!.id, ...(liked ?? []).map((l) => l.receiver_id)];
      const { data, error } = await (supabase as any)
        .from("public_profiles")
        .select(
          "id, full_name, age, gender, location, bio, avatar_url, interests, occupation, relationship_goal",
        )
        .not("id", "in", `(${excludeIds.join(",")})`)
        .order("id", { ascending: true })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const likeM = useMutation({
    mutationFn: async (receiverId: string) => {
      const { error } = await supabase
        .from("likes")
        .insert({ sender_id: user!.id, receiver_id: receiverId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allProfiles = useMemo(() => {
    const all = (profilesQ.data?.pages ?? []).flat();
    const skip = new Set(passed);
    return all.filter((p) => !skip.has(p.id));
  }, [profilesQ.data, passed]);

  const profiles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return allProfiles.filter((profile) => {
      const matchesGender = genderFilter === "all" || profile.gender === genderFilter;
      const matchesSearch = !term || [profile.full_name, profile.location, ...(profile.interests ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(term);
      return matchesGender && matchesSearch;
    });
  }, [allProfiles, genderFilter, searchTerm]);

  // Prefetch next card image
  useEffect(() => {
    allProfiles.slice(0, 6).forEach((profile) => {
      if (profile.avatar_url) {
        const img = new Image();
        img.src = profile.avatar_url;
      }
    });
  }, [allProfiles]);

  // Load more before running out
  useEffect(() => {
    if (
      allProfiles.length <= PREFETCH_THRESHOLD &&
      profilesQ.hasNextPage &&
      !profilesQ.isFetchingNextPage
    ) {
      profilesQ.fetchNextPage();
    }
  }, [profiles.length, profilesQ]);

  const handleLike = async (p: Profile) => {
    if (likedLocal.includes(p.id) || likeM.isPending) return;
    setLikedLocal((l) => [...l, p.id]);
    try {
      await likeM.mutateAsync(p.id);
      toast.success(`You liked ${p.full_name.split(" ")[0]} 💖`);
    } catch {
      setLikedLocal((l) => l.filter((x) => x !== p.id));
    }
  };

  if (profilesQ.isLoading) return <Loader>Finding people near you…</Loader>;

  if (!allProfiles.length && !profilesQ.hasNextPage) {
    return (
      <div className="discover-empty">
        <Sparkles className="mx-auto size-9" />
        <h2>You're all caught up</h2>
        <p>New profiles join every day. Check back soon or explore your matches.</p>
        <Link to="/matches" className="discover-empty-action">View matches</Link>
      </div>
    );
  }

  return (
    <div className="discover-page">
      <label className="discover-search">
        <Search className="size-4" />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search your match"
          aria-label="Search your match"
        />
      </label>

      <div className="discover-story-row" aria-label="Profile categories">
        {allProfiles.slice(0, 8).map((profile) => (
          <button key={profile.id} type="button" className="discover-story" onClick={() => setSearchTerm(profile.full_name)}>
            <span className="discover-story-image">
              <ProfileAvatar profile={profile} />
            </span>
            <span>{profile.full_name.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      <div className="discover-filter-row" aria-label="Profile filters">
        {(["all", "female", "male", "other"] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setGenderFilter(filter)}
            className={genderFilter === filter ? "discover-filter active" : "discover-filter"}
          >
            {filter === "all" ? "All profiles" : filter === "female" ? "Women" : filter === "male" ? "Men" : "Other"}
          </button>
        ))}
      </div>

      <div className="discover-section-heading">
        <div>
          <p className="discover-section-kicker">Find your kind of connection</p>
          <h1>Featured Profiles</h1>
        </div>
        <span>{profiles.length} nearby</span>
      </div>

      {!profiles.length ? (
        <div className="discover-filter-empty">No profiles match that search yet.</div>
      ) : (
        <div className="discover-grid">
          {profiles.map((profile, index) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.3 }}
            >
              <ProfileGridCard
                profile={profile}
                liked={likedLocal.includes(profile.id)}
                onLike={() => void handleLike(profile)}
              />
            </motion.div>
          ))}
        </div>
      )}
      {profilesQ.isFetchingNextPage && <p className="discover-loading-more">Finding more people…</p>}
    </div>
  );
}

function ProfileGridCard({
  profile,
  liked,
  onLike,
}: {
  profile: Profile;
  liked: boolean;
  onLike: () => void;
}) {
  return (
    <article className="discover-profile-card">
      <div className="discover-profile-image">
        <ProfileAvatar profile={profile} />
        <DiscoverRevealButton profileId={profile.id} />
      </div>
      <div className="discover-profile-meta">
        <div className="min-w-0">
          <h2>{profile.full_name}</h2>
          <p><span>{profile.age} yrs</span><span className="discover-meta-dot">·</span><MapPin className="size-3" />{profile.location}</p>
        </div>
        <button
          type="button"
          onClick={onLike}
          className={liked ? "discover-like liked" : "discover-like"}
          aria-label={liked ? `Liked ${profile.full_name}` : `Like ${profile.full_name}`}
          aria-pressed={liked}
        >
          <Heart className="size-5" fill={liked ? "currentColor" : "none"} />
        </button>
      </div>
    </article>
  );
}

function DiscoverRevealButton({ profileId }: { profileId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reveal = useServerFn(revealPhone);
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const handleReveal = async () => {
    if (busy || phone) return;
    setBusy(true);
    try {
      const result = await reveal({ data: { profileOwnerId: profileId, idempotencyKey } });
      setPhone(result.phone);
      toast.success(result.alreadyRevealed ? "Number already revealed." : "Contact unlocked!");
      await qc.invalidateQueries({ queryKey: ["balance"] });
    } catch (error) {
      const message = (error as Error).message;
      toast.error(message);
      if (/subscription|balance|plan/i.test(message)) navigate({ to: "/plans" });
    } finally {
      setBusy(false);
    }
  };

  if (phone) {
    const whatsappPhone = phone.replace(/\D/g, "");
    return (
      <a
        className="discover-reveal-indicator"
        href={`https://wa.me/${whatsappPhone}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open WhatsApp chat with ${phone}`}
        title={`Open WhatsApp: ${phone}`}
        onClick={(event) => event.stopPropagation()}
      >
        <Phone className="size-3.5" aria-hidden="true" />
        <span>{phone}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      className="discover-reveal-indicator"
      aria-label="Reveal number and open WhatsApp"
      title="Reveal number"
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        void handleReveal();
      }}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Phone className="size-3.5" aria-hidden="true" />}
      <span>{busy ? "Revealing…" : "Reveal"}</span>
    </button>
  );
}

function ProfileAvatar({ profile }: { profile: Profile }) {
  return profile.avatar_url ? (
    <img
      src={profile.avatar_url}
      alt={profile.full_name}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  ) : (
    <div className="discover-avatar-fallback" aria-label={`${profile.full_name} profile placeholder`}>
      {profile.full_name.charAt(0)}
    </div>
  );
}

function Loader({ children }: { children: React.ReactNode }) {
  return (
    <div className="discover-page">
      <div className="discover-skeleton-search" />
      <div className="discover-skeleton-stories">
        {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
      </div>
      <p className="discover-loading-label">{children}</p>
      <div className="discover-grid discover-skeleton-grid">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="discover-skeleton-card" />)}
      </div>
    </div>
  );
}
