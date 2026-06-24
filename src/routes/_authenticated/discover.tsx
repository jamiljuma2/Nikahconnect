import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Heart, X, MapPin, Briefcase, Sparkles } from "lucide-react";
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

function Discover() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [passed, setPassed] = useState<string[]>([]);

  const profilesQ = useQuery({
    queryKey: ["discover", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: liked } = await supabase
        .from("likes")
        .select("receiver_id")
        .eq("sender_id", user!.id);
      const excludeIds = [user!.id, ...(liked ?? []).map((l) => l.receiver_id)];
      // public_profiles view exposes only safe columns (no email/phone/dob).
      const { data, error } = await (supabase as any)
        .from("public_profiles")
        .select("id, full_name, age, gender, location, bio, avatar_url, interests, occupation, relationship_goal")
        .not("id", "in", `(${excludeIds.join(",")})`)
        .limit(30);
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
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["discover"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const profiles = (profilesQ.data ?? []).filter((p) => !passed.includes(p.id));
  const current = profiles[0];

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
      <ProfileCard profile={current} />
      <div className="mt-6 flex justify-center gap-6">
        <button
          onClick={() => setPassed((p) => [...p, current.id])}
          className="flex size-16 items-center justify-center rounded-full border border-border bg-card shadow-card transition hover:scale-105"
          aria-label="Pass"
        >
          <X className="size-7 text-muted-foreground" />
        </button>
        <button
          onClick={async () => {
            await likeM.mutateAsync(current.id);
            toast.success(`You liked ${current.full_name.split(" ")[0]} 💖`);
          }}
          className="flex size-20 items-center justify-center rounded-full gradient-romance shadow-romance transition hover:scale-105"
          aria-label="Like"
        >
          <Heart className="size-9 text-primary-foreground" fill="currentColor" />
        </button>
      </div>
    </div>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="relative aspect-[3/4] w-full bg-muted">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.full_name} className="size-full object-cover" />
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
  return (
    <div className="mt-16 text-center text-muted-foreground">{children}</div>
  );
}
