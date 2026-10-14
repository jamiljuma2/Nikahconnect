import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MapPin, MessageCircle, Sparkles, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AtomLoader } from "@/components/AtomLoader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { notifyUserError } from "@/lib/user-facing-errors";
import { getMyBalance } from "@/lib/dating.functions";

export const Route = createFileRoute("/_authenticated/likes")({
  head: () => ({
    meta: [
      { title: "Likes — NikahConnect" },
      { name: "description", content: "See the people who are interested in meeting you." },
    ],
  }),
  component: LikesPage,
});

interface Liker {
  id: string;
  full_name: string;
  age: number | null;
  location: string | null;
  bio: string | null;
  avatar_url: string | null;
  interests: string[] | null;
  created_at: string;
  matchId: string | null;
}

function LikesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const planQ = useQuery({
    queryKey: ["balance"],
    enabled: !!user,
    queryFn: () => getMyBalance(),
  });
  const canSeeLikes = !!planQ.data?.activePlan;
  const likesQ = useQuery({
    queryKey: ["people-who-like-me", user?.id],
    enabled: !!user && canSeeLikes,
    queryFn: async () => {
      const { data: incomingLikes, error: likesError } = await supabase
        .from("likes")
        .select("sender_id, created_at")
        .eq("receiver_id", user!.id)
        .order("created_at", { ascending: false });
      if (likesError) throw likesError;
      if (!incomingLikes?.length) return [] as Liker[];

      const likerIds = [...new Set(incomingLikes.map((like) => like.sender_id))];
      const [profilesResult, matchesResult] = await Promise.all([
        supabase
          .from("public_profiles")
          .select("id, full_name, age, location, bio, avatar_url, interests")
          .in("id", likerIds),
        supabase
          .from("matches")
          .select("id, user_one, user_two")
          .or(`user_one.eq.${user!.id},user_two.eq.${user!.id}`),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (matchesResult.error) throw matchesResult.error;

      const profileMap = new Map<string, Omit<Liker, "created_at" | "matchId">>();
      for (const profile of profilesResult.data ?? []) {
        if (!profile.id) continue;
        profileMap.set(profile.id, {
          id: profile.id,
          full_name: profile.full_name ?? "Member",
          age: profile.age,
          location: profile.location,
          bio: profile.bio,
          avatar_url: profile.avatar_url,
          interests: profile.interests,
        });
      }
      const matchMap = new Map<string, string>();
      for (const match of matchesResult.data ?? []) {
        matchMap.set(match.user_one === user!.id ? match.user_two : match.user_one, match.id);
      }

      return incomingLikes.flatMap((like) => {
        const profile = profileMap.get(like.sender_id);
        return profile
          ? [
              {
                ...profile,
                created_at: like.created_at,
                matchId: matchMap.get(like.sender_id) ?? null,
              },
            ]
          : [];
      });
    },
  });

  const likeBack = useMutation({
    mutationFn: async (receiverId: string) => {
      const { error } = await supabase
        .from("likes")
        .insert({ sender_id: user!.id, receiver_id: receiverId });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("It’s a match! You can start chatting now.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["people-who-like-me", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["app-notifications", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["message-inbox", user?.id] }),
      ]);
    },
    onError: (error: Error) =>
      notifyUserError(error, "We couldn’t update your likes. Please try again."),
  });

  return (
    <main className="likes-page">
      <header className="likes-heading">
        <div className="likes-heading-mark">
          <Heart size={21} fill="currentColor" />
        </div>
        <div>
          <h1>Likes you</h1>
        </div>
        {canSeeLikes && <span className="likes-total">{likesQ.data?.length ?? 0}</span>}
      </header>

      {planQ.isLoading ? (
        <AtomLoader className="likes-loading" label="Checking your plan…" size={30} />
      ) : planQ.isError ? (
        <div className="likes-empty-state">
          <p>Your plan couldn’t be checked right now.</p>
          <Button variant="outline" onClick={() => void planQ.refetch()}>
            Try again
          </Button>
        </div>
      ) : !canSeeLikes ? (
        <div className="likes-empty-state likes-upgrade-state">
          <span>
            <LockKeyhole size={22} />
          </span>
          <h2>See who’s interested in you</h2>
          <p>An active subscription lets you view the people who have liked your profile.</p>
          <Link to="/plans">View plans</Link>
        </div>
      ) : likesQ.isLoading ? (
        <AtomLoader className="likes-loading" label="Loading likes…" size={30} />
      ) : likesQ.isError ? (
        <div className="likes-empty-state">
          <p>Likes couldn’t load right now.</p>
          <Button variant="outline" onClick={() => void likesQ.refetch()}>
            Try again
          </Button>
        </div>
      ) : !likesQ.data?.length ? (
        <div className="likes-empty-state">
          <span>
            <Sparkles size={22} />
          </span>
          <h2>No likes yet</h2>
          <p>New likes will appear here.</p>
          <Link to="/discover">Explore profiles</Link>
        </div>
      ) : (
        <div className="likes-grid">
          {likesQ.data.map((liker) => (
            <article className="likes-card" key={liker.id}>
              <div className="likes-card-photo">
                {liker.avatar_url ? (
                  <img src={liker.avatar_url} alt={`${liker.full_name}'s profile`} />
                ) : (
                  <span className="likes-avatar-fallback">{liker.full_name.charAt(0)}</span>
                )}
                <span className="likes-heart-badge">
                  <Heart size={15} fill="currentColor" />
                </span>
              </div>
              <div className="likes-card-content">
                <h2>
                  {liker.full_name}
                  {liker.age ? <span>, {liker.age}</span> : null}
                </h2>
                <p className="likes-location">
                  <MapPin size={13} />
                  {liker.location || "Location not set"}
                </p>
                {liker.bio && <p className="likes-bio">{liker.bio}</p>}
                {liker.interests?.length ? (
                  <div className="likes-interests">
                    {liker.interests.slice(0, 3).map((interest) => (
                      <span key={interest}>{interest}</span>
                    ))}
                  </div>
                ) : null}
                {liker.matchId ? (
                  <Link
                    className="likes-message-action"
                    to="/chat/$matchId"
                    params={{ matchId: liker.matchId }}
                  >
                    <MessageCircle size={16} /> Message your match
                  </Link>
                ) : (
                  <Button
                    className="likes-action"
                    onClick={() => likeBack.mutate(liker.id)}
                    disabled={likeBack.isPending}
                  >
                    <Heart size={16} /> Like back
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
