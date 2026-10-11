import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Camera, Check, Loader2, Menu, ShieldAlert, UserRound, UserRoundX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useServerFn } from "@tanstack/react-start";
import {
  deactivateMyAccount,
  permanentlyDeleteMyAccount,
  reactivateMyAccount,
} from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifyUserError } from "@/lib/user-facing-errors";
import { isProfileComplete } from "@/lib/profile-completion";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (search) =>
    z
      .object({
        setup: z.preprocess((value) => (value === 1 ? "1" : value), z.enum(["1"]).optional()),
      })
      .parse(search),
  head: () => ({
    meta: [
      { title: "Settings — MingleConnect" },
      { name: "description", content: "Update your MingleConnect dating profile and preferences." },
      { property: "og:title", content: "Settings — MingleConnect" },
      {
        property: "og:description",
        content: "Update your MingleConnect dating profile and preferences.",
      },
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
  const deactivateAccount = useServerFn(deactivateMyAccount);
  const reactivateAccount = useServerFn(reactivateMyAccount);
  const permanentlyDeleteAccount = useServerFn(permanentlyDeleteMyAccount);
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
  const [profileLoading, setProfileLoading] = useState(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [deactivatedAt, setDeactivatedAt] = useState<string | null>(null);
  const [accountDialog, setAccountDialog] = useState<"deactivate" | "delete" | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "full_name, location, bio, occupation, relationship_goal, interests, avatar_url, deactivated_at",
        )
        .eq("id", user.id)
        .single();
      if (active && data) {
        setForm({
          full_name: data.full_name ?? "",
          location: data.location ?? "",
          bio: data.bio ?? "",
          occupation: data.occupation ?? "",
          relationship_goal: data.relationship_goal ?? "",
          interests: (data.interests ?? []).join(", "),
          avatar_url: data.avatar_url ?? "",
        });
        setDeactivatedAt(data.deactivated_at);
        if (!isProfileComplete(data) && setup !== "1") {
          void navigate({ to: "/settings", search: { setup: "1" }, replace: true });
        }
      }
      if (active) {
        if (error) notifyUserError(error, "We couldn’t load your profile. Please try again.");
        setProfileLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate, setup, user]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handleAccountAction = async () => {
    if (accountDialog === "delete" && deleteConfirmation !== "DELETE") return;
    setAccountBusy(true);
    try {
      if (accountDialog === "deactivate") {
        await deactivateAccount();
        await supabase.auth.signOut({ scope: "local" });
        toast.success("Your account is paused. Sign in again when you’re ready to return.");
        await navigate({ to: "/auth", search: { mode: "login" } });
        return;
      }

      const result = await permanentlyDeleteAccount();
      await supabase.auth.signOut({ scope: "local" });
      setAccountDialog(null);
      toast.success(
        result.photosRemoved
          ? "Your account has been permanently deleted."
          : "Your account was deleted, but some uploaded photos could not be removed.",
      );
      await navigate({ to: "/auth", search: { mode: "login" } });
    } catch (error) {
      notifyUserError(error, "We couldn’t update your account. Please try again.");
    } finally {
      setAccountBusy(false);
    }
  };

  const handleReactivate = async () => {
    setAccountBusy(true);
    try {
      await reactivateAccount();
      setDeactivatedAt(null);
      toast.success("Your account is active again.");
      window.location.assign("/discover");
    } catch (error) {
      notifyUserError(error, "We couldn’t reactivate your account. Please try again.");
    } finally {
      setAccountBusy(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const profileToSave = {
      ...form,
      interests: form.interests
        .split(",")
        .map((interest) => interest.trim())
        .filter(Boolean),
    };
    if (isSetup && !isProfileComplete(profileToSave)) {
      toast.error("Add a profile photo and complete the required profile details to continue.");
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
        interests: profileToSave.interests,
        avatar_url: form.avatar_url || null,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) notifyUserError(error, "We couldn’t save your profile. Please try again.");
    else if (isSetup) {
      toast.success("Profile complete. Welcome to MingleConnect!");
      navigate({ to: "/discover" });
    } else toast.success("Profile saved");
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setPhotoError(null);
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!validTypes.includes(file.type)) {
      setPhotoError("Choose a JPG, PNG, WebP, or AVIF image.");
      return;
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setPhotoError(
        file.size === 0
          ? "This image is empty. Choose another file."
          : "Photos must be 5 MB or smaller.",
      );
      return;
    }

    setPhotoPreview(URL.createObjectURL(file));
    setUploading(true);
    let uploadedPath: string | null = null;
    let savedPhotoUrl: string | null = null;
    try {
      const extension = file.type === "image/jpeg" ? "jpg" : file.type.slice("image/".length);
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      uploadedPath = path;

      const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
      const url = data.publicUrl;
      const { error: photoError } = await supabase
        .from("profile_photos")
        .insert({ user_id: user.id, url });
      if (photoError) throw photoError;
      savedPhotoUrl = url;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);
      if (profileError) throw profileError;

      setForm((current) => ({ ...current, avatar_url: url }));
      setPhotoPreview(null);
      toast.success("Your profile photo is uploaded and saved.");
    } catch (error) {
      if (savedPhotoUrl) {
        try {
          const { error: cleanupError } = await supabase
            .from("profile_photos")
            .delete()
            .eq("user_id", user.id)
            .eq("url", savedPhotoUrl);
          if (cleanupError)
            console.error("Could not clean up an unsuccessful profile photo record", cleanupError);
        } catch (cleanupError) {
          console.error("Could not clean up an unsuccessful profile photo record", cleanupError);
        }
      }
      if (uploadedPath) {
        try {
          const { error: cleanupError } = await supabase.storage
            .from("profile-photos")
            .remove([uploadedPath]);
          if (cleanupError)
            console.error("Could not clean up an unsuccessful profile photo upload", cleanupError);
        } catch (cleanupError) {
          console.error("Could not clean up an unsuccessful profile photo upload", cleanupError);
        }
      }
      setPhotoPreview(null);
      setPhotoError("We couldn’t save that photo. Check your connection and try again.");
      notifyUserError(error, "We couldn’t upload your photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const profileChecklist = [
    { label: "Profile photo", complete: Boolean(form.avatar_url) },
    {
      label: "Name and location",
      complete: Boolean(form.full_name.trim() && form.location.trim()),
    },
    { label: "Occupation", complete: Boolean(form.occupation.trim()) },
    { label: "Relationship goal", complete: Boolean(form.relationship_goal.trim()) },
    {
      label: "Interests",
      complete: form.interests.split(",").some((interest) => interest.trim()),
    },
  ];
  const completion = Math.round(
    (profileChecklist.filter((item) => item.complete).length / profileChecklist.length) * 100,
  );

  return (
    <div className={`settings-page ${isSetup ? "settings-page-setup" : ""}`}>
      <div className="settings-page-heading">
        <p className="profile-kicker">{isSetup ? "Welcome to MingleConnect" : "Your account"}</p>
        <h1>{isSetup ? "Complete your profile" : "Edit profile"}</h1>
        <p>
          {isSetup
            ? "Add a few details so people can get to know you."
            : "Manage your profile details and account."}
        </p>
      </div>

      <div className="settings-mobile-menu">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="settings-mobile-menu-trigger">
              <Menu className="size-4" aria-hidden="true" />
              Settings sections
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="settings-mobile-drawer">
            <SheetHeader className="settings-drawer-heading">
              <SheetTitle>Settings</SheetTitle>
              <SheetDescription>
                {isSetup ? "Finish setting up your profile." : "Manage your profile and account."}
              </SheetDescription>
            </SheetHeader>
            <div className="settings-drawer-profile">
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="" className="settings-drawer-avatar" />
              ) : (
                <span className="settings-drawer-avatar settings-drawer-avatar-fallback">
                  {form.full_name.charAt(0) || "?"}
                </span>
              )}
              <span>{form.full_name || "Your profile"}</span>
            </div>
            <nav className="settings-drawer-nav" aria-label="Settings sections">
              <SheetClose asChild>
                <a href="#photo-heading">
                  <Camera aria-hidden="true" />
                  <span>Profile photo</span>
                </a>
              </SheetClose>
              <SheetClose asChild>
                <a href="#basic-info-heading">
                  <UserRound aria-hidden="true" />
                  <span>Profile</span>
                </a>
              </SheetClose>
              <SheetClose asChild>
                <a href="#about-heading">
                  <Check aria-hidden="true" />
                  <span>About you</span>
                </a>
              </SheetClose>
              {!isSetup ? (
                <SheetClose asChild>
                  <a href="#account-controls-heading">
                    <ShieldAlert aria-hidden="true" />
                    <span>Account controls</span>
                  </a>
                </SheetClose>
              ) : null}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <div className="settings-layout">
        <div className="settings-main-column">
          <form onSubmit={save} className="profile-form settings-profile-form">
            <section
              className="profile-photo-section settings-card"
              aria-labelledby="photo-heading"
            >
              <div className="profile-photo-copy">
                <p id="photo-heading" className="profile-section-label">
                  Profile photo
                </p>
                <p className="profile-section-hint">
                  {isSetup
                    ? "Add a clear photo to finish setting up your profile. JPG, PNG, WebP, or AVIF · up to 5 MB."
                    : "A warm first impression goes a long way. JPG, PNG, WebP, or AVIF · up to 5 MB."}
                </p>
              </div>
              <div className="profile-photo-upload-area">
                <div className="profile-photo-control">
                  {photoPreview || form.avatar_url ? (
                    <img
                      src={photoPreview ?? form.avatar_url}
                      alt={photoPreview ? "Preview of your selected profile photo" : "Your profile"}
                      className="profile-avatar"
                    />
                  ) : (
                    <div className="profile-avatar profile-avatar-fallback">
                      {form.full_name.charAt(0) || "?"}
                    </div>
                  )}
                  <Label
                    className={`profile-upload cursor-pointer ${uploading || profileLoading ? "profile-upload-disabled" : ""}`}
                  >
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      className="sr-only"
                      aria-label="Upload a profile photo"
                      disabled={uploading || profileLoading}
                      onChange={onUpload}
                    />
                    <span>
                      {uploading || profileLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Camera className="size-4" />
                      )}
                      {profileLoading
                        ? "Loading profile…"
                        : uploading
                          ? "Uploading photo…"
                          : form.avatar_url
                            ? "Change photo"
                            : "Upload photo"}
                    </span>
                  </Label>
                </div>
                {uploading ? (
                  <div className="profile-upload-status" role="status">
                    <span>Uploading and saving your photo…</span>
                    <div
                      className="profile-upload-progress"
                      role="progressbar"
                      aria-label="Photo upload progress"
                      aria-valuetext="Upload in progress"
                    >
                      <span />
                    </div>
                  </div>
                ) : null}
                {photoError ? (
                  <p className="profile-photo-error" role="alert">
                    {photoError}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="profile-section settings-card" aria-labelledby="basic-info-heading">
              <div className="profile-section-heading">
                <p id="basic-info-heading" className="profile-section-label">
                  Profile
                </p>
                <p className="profile-section-hint">The basics people notice first.</p>
              </div>
              <div className="profile-fields profile-fields-three">
                <Field label="Full name" id="full-name">
                  <Input
                    id="full-name"
                    required={isSetup}
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </Field>
                <Field label="Location" id="location">
                  <Input
                    id="location"
                    required={isSetup}
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </Field>
                <Field label="Occupation" id="occupation">
                  <Input
                    id="occupation"
                    required={isSetup}
                    value={form.occupation}
                    onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                  />
                </Field>
              </div>
            </section>

            <section className="profile-section settings-card" aria-labelledby="about-heading">
              <div className="profile-section-heading">
                <p id="about-heading" className="profile-section-label">
                  About you
                </p>
                <p className="profile-section-hint">Share the details that make you, you.</p>
              </div>
              <div className="profile-fields settings-about-fields">
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
              <Button type="submit" className="profile-save settings-action-button" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Check className="size-4" /> {isSetup ? "Complete setup" : "Save profile"}
                  </>
                )}
              </Button>
            </div>
          </form>

          {!isSetup ? (
            <section
              className="profile-section settings-card settings-account-card"
              aria-labelledby="account-controls-heading"
            >
              <div className="profile-section-heading">
                <p id="account-controls-heading" className="profile-section-label">
                  Account controls
                </p>
                <p className="profile-section-hint">
                  Take a break or remove your account and profile.
                </p>
              </div>

              {deactivatedAt ? (
                <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  Your account is temporarily deactivated and hidden from Discover. Reactivate it
                  whenever you’re ready.
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-white/70 p-5">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <ShieldAlert className="size-4 text-primary" /> Temporarily deactivate
                  </h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">
                    Hide your profile from Discover. Your account and conversations stay saved, and
                    you can reactivate after signing in.
                  </p>
                  {deactivatedAt ? (
                    <Button
                      type="button"
                      className="settings-account-action mt-4"
                      onClick={handleReactivate}
                      disabled={accountBusy}
                    >
                      {accountBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                      Reactivate account
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="settings-account-action mt-4"
                      onClick={() => setAccountDialog("deactivate")}
                    >
                      Deactivate temporarily
                    </Button>
                  )}
                </div>

                <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.03] p-5">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <UserRoundX className="size-4 text-destructive" /> Permanently delete
                  </h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">
                    Delete your profile, photos, matches, messages, and account access. Completed
                    payment totals are retained for accounting with your account and M-Pesa number
                    removed.
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    className="settings-account-action mt-4"
                    onClick={() => setAccountDialog("delete")}
                  >
                    Delete account permanently
                  </Button>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="settings-progress-card" aria-labelledby="profile-progress-heading">
          <h2 id="profile-progress-heading">Profile completion</h2>
          <div
            className="settings-progress-ring"
            style={{
              background: `conic-gradient(var(--color-primary) ${completion}%, var(--color-border) ${completion}% 100%)`,
            }}
            role="img"
            aria-label={`Profile ${completion}% complete`}
          >
            <span>{completion}%</span>
          </div>
          <ul className="settings-progress-list">
            {profileChecklist.map((item) => (
              <li key={item.label} className={item.complete ? "is-complete" : ""}>
                <span className="settings-progress-mark" aria-hidden="true">
                  {item.complete ? <Check className="size-3.5" /> : null}
                </span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {!isSetup ? (
        <AlertDialog
          open={accountDialog !== null}
          onOpenChange={(open) => {
            if (!open && !accountBusy) {
              setAccountDialog(null);
              setDeleteConfirmation("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {accountDialog === "delete"
                  ? "Permanently delete your account?"
                  : "Temporarily deactivate your account?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {accountDialog === "delete"
                  ? "This cannot be undone. Your profile, photos, matches, messages, and account access will be removed. Completed payment totals will be anonymized and retained for accounting."
                  : "Your profile will be hidden from Discover and you’ll be signed out. Sign in again and reactivate whenever you want to return."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {accountDialog === "delete" ? (
              <div className="grid gap-2">
                <Label htmlFor="confirm-account-delete">Type DELETE to confirm</Label>
                <Input
                  id="confirm-account-delete"
                  autoComplete="off"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                />
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={accountBusy}>Cancel</AlertDialogCancel>
              <Button
                type="button"
                variant={accountDialog === "delete" ? "destructive" : "default"}
                disabled={
                  accountBusy || (accountDialog === "delete" && deleteConfirmation !== "DELETE")
                }
                onClick={handleAccountAction}
              >
                {accountBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                {accountDialog === "delete" ? "Delete permanently" : "Deactivate"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
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
