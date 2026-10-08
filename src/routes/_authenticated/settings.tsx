import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Camera, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (search) => z.object({ setup: z.enum(["1"]).optional() }).parse(search),
  head: () => ({
    meta: [
      { title: "Settings — MingleConnect" },
      { name: "description", content: "Update your MingleConnect dating profile and preferences." },
      { property: "og:title", content: "Settings — MingleConnect" },
      { property: "og:description", content: "Update your MingleConnect dating profile and preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { setup } = Route.useSearch();
  const isSetup = setup === "1";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    full_name: "",
    location: "",
    bio: "",
    occupation: "",
    relationship_goal: "",
    interests: "",
    avatar_url: "",
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, location, bio, occupation, relationship_goal, interests, avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setForm({
          full_name: data.full_name ?? "",
          location: data.location ?? "",
          bio: data.bio ?? "",
          occupation: data.occupation ?? "",
          relationship_goal: data.relationship_goal ?? "",
          interests: (data.interests ?? []).join(", "),
          avatar_url: data.avatar_url ?? "",
        });
      });
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (
      isSetup &&
      (!form.full_name.trim() ||
        !form.location.trim() ||
        !form.occupation.trim() ||
        !form.relationship_goal.trim() ||
        !form.interests.trim())
    ) {
      toast.error("Complete the required profile details before continuing.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        location: form.location,
        bio: form.bio,
        occupation: form.occupation,
        relationship_goal: form.relationship_goal,
        interests: form.interests.split(",").map((s) => s.trim()).filter(Boolean),
        avatar_url: form.avatar_url || null,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else if (isSetup) {
      toast.success("Profile complete. Welcome to MingleConnect!");
      navigate({ to: "/discover" });
    } else toast.success("Profile saved");
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("profile-photos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    const { data: signed } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl ?? "";
    setForm((f) => ({ ...f, avatar_url: url }));
    await supabase.from("profile_photos").insert({ user_id: user.id, url });
    setUploading(false);
    toast.success("Photo uploaded — don't forget to save.");
  };

  return (
    <div className="profile-page">
      <div className="profile-heading">
        <p className="profile-kicker">{isSetup ? "Welcome to MingleConnect" : "Your MingleConnect profile"}</p>
        <h1>{isSetup ? "Complete your profile" : "Your profile"}</h1>
        <p>{isSetup ? "Add a few details so people can get to know you." : "Keep it honest. Keep it you."}</p>
      </div>

      <form onSubmit={save} className="profile-form">
        <section className="profile-photo-section" aria-labelledby="photo-heading">
          <div className="profile-photo-copy">
            <p id="photo-heading" className="profile-section-label">Profile photo</p>
            <p className="profile-section-hint">A warm first impression goes a long way.</p>
          </div>
          <div className="profile-photo-control">
          {form.avatar_url ? (
            <img src={form.avatar_url} alt="Your profile" className="profile-avatar" />
          ) : (
            <div className="profile-avatar profile-avatar-fallback">
              {form.full_name.charAt(0) || "?"}
            </div>
          )}
          <Label className="profile-upload cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
            <span>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              {uploading ? "Uploading…" : "Upload photo"}
            </span>
          </Label>
          </div>
        </section>

        <section className="profile-section" aria-labelledby="basic-info-heading">
          <div className="profile-section-heading">
            <p id="basic-info-heading" className="profile-section-label">Profile</p>
            <p className="profile-section-hint">The basics people notice first.</p>
          </div>
          <div className="profile-fields profile-fields-three">
            <Field label="Full name" id="full-name">
              <Input id="full-name" required={isSetup} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="Location" id="location">
              <Input id="location" required={isSetup} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="Occupation" id="occupation">
              <Input id="occupation" required={isSetup} value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="profile-section" aria-labelledby="about-heading">
          <div className="profile-section-heading">
            <p id="about-heading" className="profile-section-label">About you</p>
            <p className="profile-section-hint">Share the details that make you, you.</p>
          </div>
          <div className="profile-fields">
            <Field label="Relationship goal" id="relationship-goal">
              <Input
                id="relationship-goal"
                required={isSetup}
                placeholder="Long-term partner, friendship, dating…"
                value={form.relationship_goal}
                onChange={(e) => setForm({ ...form, relationship_goal: e.target.value })}
              />
            </Field>
            <Field label="Interests (comma-separated)" id="interests">
              <Input
                id="interests"
                required={isSetup}
                placeholder="hiking, jazz, cooking"
                value={form.interests}
                onChange={(e) => setForm({ ...form, interests: e.target.value })}
              />
            </Field>
            <Field label="Bio" id="bio">
              <Textarea
                id="bio"
                rows={4}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </Field>
          </div>
        </section>

        <div className="profile-actions">
          <Button type="submit" className="profile-save" disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : <><Check className="size-4" /> {isSetup ? "Complete setup" : "Save profile"}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="profile-field">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
