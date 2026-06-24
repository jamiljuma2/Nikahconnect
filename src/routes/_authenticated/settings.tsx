import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — MingleConnect" }] }),
  component: SettingsPage,
});

function SettingsPage() {
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
    else toast.success("Profile saved");
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
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-semibold">Your profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">Keep it honest. Keep it you.</p>

      <form onSubmit={save} className="mt-6 space-y-5">
        <div className="flex items-center gap-4">
          {form.avatar_url ? (
            <img src={form.avatar_url} alt="" className="size-20 rounded-full object-cover ring-2 ring-primary/30" />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full gradient-romance text-2xl text-primary-foreground">
              {form.full_name.charAt(0) || "?"}
            </div>
          )}
          <Label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
            <span className="inline-flex items-center justify-center rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-accent">
              {uploading ? "Uploading…" : "Upload photo"}
            </span>
          </Label>
        </div>

        <Field label="Full name">
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </Field>
        <Field label="Location">
          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </Field>
        <Field label="Occupation">
          <Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
        </Field>
        <Field label="Relationship goal">
          <Input
            placeholder="Long-term partner, friendship, dating…"
            value={form.relationship_goal}
            onChange={(e) => setForm({ ...form, relationship_goal: e.target.value })}
          />
        </Field>
        <Field label="Interests (comma-separated)">
          <Input
            placeholder="hiking, jazz, cooking"
            value={form.interests}
            onChange={(e) => setForm({ ...form, interests: e.target.value })}
          />
        </Field>
        <Field label="Bio">
          <Textarea
            rows={4}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </Field>
        <Button type="submit" className="gradient-romance text-primary-foreground" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
