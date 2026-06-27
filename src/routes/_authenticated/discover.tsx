import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Heart, X, MapPin, Briefcase, Sparkles } from "lucide-react";
import { motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({ meta: [{ title: "Discover — MingleConnect" }] }),
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

  const profiles = useMemo(() => {
    const all = (profilesQ.data?.pages ?? []).flat();
    const skip = new Set([...passed, ...likedLocal]);
    return all.filter((p) => !skip.has(p.id));
  }, [profilesQ.data, passed, likedLocal]);

  const current = profiles[0];
  const next = profiles[1];

  // Prefetch next card image
  useEffect(() => {
    if (next?.avatar_url) {
      const img = new Image();
      img.src = next.avatar_url;
    }
  }, [next?.avatar_url]);

  // Load more before running out
  useEffect(() => {
    if (
      profiles.length <= PREFETCH_THRESHOLD &&
      profilesQ.hasNextPage &&
      !profilesQ.isFetchingNextPage
    ) {
      profilesQ.fetchNextPage();
    }
  }, [profiles.length, profilesQ]);

  const handlePass = (id: string) => setPassed((p) => [...p, id]);
  const handleLike = async (p: Profile) => {
    setLikedLocal((l) => [...l, p.id]);
    try {
      await likeM.mutateAsync(p.id);
      toast.success(`You liked ${p.full_name.split(" ")[0]} 💖`);
    } catch {
      setLikedLocal((l) => l.filter((x) => x !== p.id));
    }
  };

  if (profilesQ.isLoading) return <Loader>Finding people near you…</Loader>;

  if (!current) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <Sparkles className="mx-auto size-10 text-primary" />
        <h2 className="mt-4 font-display text-3xl font-semibold">You're all caught up</h2>
        <p className="mt-2 text-muted-foreground">
          New profiles join every day. Check back soon — or peek at your matches.
        </p>
        <Link to="/matches">
          <Button className="mt-6 gradient-romance text-primary-foreground">View matches</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="relative h-[560px] select-none">
        {next && (
          <div className="absolute inset-0 scale-[0.96] opacity-70" aria-hidden>
            <ProfileCard profile={next} />
          </div>
        )}
        <SwipeCard
          key={current.id}
          profile={current}
          onPass={() => handlePass(current.id)}
          onLike={() => handleLike(current)}
        />
      </div>
      <div className="mt-6 flex justify-center gap-6">
        <button
          onClick={() => handlePass(current.id)}
          className="flex size-16 items-center justify-center rounded-full border border-border bg-card shadow-card transition hover:scale-105"
          aria-label="Pass"
        >
          <X className="size-7 text-muted-foreground" />
        </button>
        <button
          onClick={() => handleLike(current)}
          className="flex size-20 items-center justify-center rounded-full gradient-romance shadow-romance transition hover:scale-105"
          aria-label="Like"
        >
          <Heart className="size-9 text-primary-foreground" fill="currentColor" />
        </button>
      </div>
    </div>
  );
}

function SwipeCard({
  profile,
  onPass,
  onLike,
}: {
  profile: Profile;
  onPass: () => void;
  onLike: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const likeOpacity = useTransform(x, [40, 160], [0, 1]);
  const passOpacity = useTransform(x, [-160, -40], [1, 0]);

  const handleEnd = (_: unknown, info: PanInfo) => {
    const threshold = 140;
    if (info.offset.x > threshold || info.velocity.x > 600) onLike();
    else if (info.offset.x < -threshold || info.velocity.x < -600) onPass();
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleEnd}
      style={{ x, rotate }}
      whileTap={{ cursor: "grabbing" }}
      className="absolute inset-0 cursor-grab touch-none"
    >
      <ProfileCard profile={profile}>
        <motion.div
          style={{ opacity: likeOpacity }}
          className="pointer-events-none absolute left-5 top-5 rounded-lg border-4 border-emerald-400 px-3 py-1 text-2xl font-bold uppercase tracking-wider text-emerald-400 -rotate-12"
        >
          Like
        </motion.div>
        <motion.div
          style={{ opacity: passOpacity }}
          className="pointer-events-none absolute right-5 top-5 rounded-lg border-4 border-rose-500 px-3 py-1 text-2xl font-bold uppercase tracking-wider text-rose-500 rotate-12"
        >
          Nope
        </motion.div>
      </ProfileCard>
    </motion.div>
  );
}

function ProfileCard({
  profile,
  children,
}: {
  profile: Profile;
  children?: React.ReactNode;
}) {
  return (
    <article className="relative h-full overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="relative aspect-[3/4] w-full bg-muted">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.full_name}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center gradient-romance">
            <span className="font-display text-6xl text-primary-foreground">
              {profile.full_name.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5 text-white">
          <h2 className="font-display text-3xl font-semibold">
            {profile.full_name}, {profile.age}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm opacity-90">
            <MapPin className="size-3.5" />
            {profile.location}
          </p>
        </div>
        {children}
      </div>
      <div className="space-y-3 p-5">
        {profile.bio && <p className="text-sm text-foreground">{profile.bio}</p>}
        {profile.occupation && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Briefcase className="size-4" />
            {profile.occupation}
          </p>
        )}
        {profile.relationship_goal && (
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground">Looking for:</span> {profile.relationship_goal}
          </p>
        )}
        {profile.interests?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {profile.interests.map((i) => (
              <span
                key={i}
                className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground"
              >
                {i}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function Loader({ children }: { children: React.ReactNode }) {
  return <div className="mt-16 text-center text-muted-foreground">{children}</div>;
}
