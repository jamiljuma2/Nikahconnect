import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { notifyUserError } from "@/lib/user-facing-errors";

const search = z.object({
  mode: z.enum(["login", "register", "forgot", "reset"]).default("login"),
  next: z.string().optional(),
});

function safeNext(next: string | undefined): string | null {
  if (!next) return null;
  // Same-origin relative path only.
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — MingleConnect" },
      { name: "description", content: "Sign in or create your MingleConnect account." },
      { property: "og:title", content: "Sign in — MingleConnect" },
      { property: "og:description", content: "Sign in or create your MingleConnect account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode, next } = Route.useSearch();
  const router = useRouter();
  const nextPath = safeNext(next);
  const goNext = (isAdmin = false) => {
    if (isAdmin) {
      window.location.assign("/admin");
      return;
    }
    if (nextPath) {
      window.location.assign(nextPath);
    } else {
      router.navigate({ to: "/discover" });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-two" aria-hidden="true" />
      <div className="auth-band auth-band-one" aria-hidden="true" />
      <div className="auth-band auth-band-two" aria-hidden="true" />
      <div className="auth-outline auth-outline-one" aria-hidden="true" />
      <div className="auth-outline auth-outline-two" aria-hidden="true" />

      <main className={`auth-frame ${mode === "register" ? "auth-frame-register" : "auth-frame-login"}`}>
        {mode === "register" && (
          <section className="auth-intro">
            <Link to="/" className="auth-brand" aria-label="MingleConnect home">
              <BrandLogo className="auth-brand-logo" />
            </Link>
            <div className="auth-intro-copy">
              <p className="auth-kicker">Your next chapter starts here</p>
              <h1>Welcome!</h1>
              <span className="auth-rule" aria-hidden="true" />
              <p className="auth-message">
                Meet someone who matches your energy, your interests, and your story.
              </p>
              <Link to="/" className="auth-discover">Discover More</Link>
            </div>
            <p className="auth-footer-note">Meaningful connections, made at your pace.</p>
          </section>
        )}

        <section className="auth-form-shell" aria-labelledby="auth-title">
          <div className="auth-form-panel">
            <div className="auth-form-heading">
              <span className="auth-form-eyebrow">MingleConnect</span>
              <h2 id="auth-title">
                {mode === "register" ? "Create account" : mode === "forgot" ? "Reset your password" : mode === "reset" ? "Choose a new password" : "Sign in"}
              </h2>
              <span className="auth-rule auth-rule-center" aria-hidden="true" />
              <p>
                {mode === "register"
                  ? "It only takes a minute to begin."
                  : mode === "forgot"
                    ? "We’ll email you a secure link to get back into your account."
                    : mode === "reset"
                      ? "Choose a new password for your account."
                      : "Welcome back. Your story is waiting."}
              </p>
            </div>

            {(mode === "login" || mode === "register") && (
              <div className="auth-mode-tabs" aria-label="Authentication mode">
                <ModeTab to="login" current={mode}>Sign in</ModeTab>
                <ModeTab to="register" current={mode}>Register</ModeTab>
              </div>
            )}

            <div className="auth-form-content">
              {mode === "register" ? (
                <RegisterForm onDone={() => router.navigate({ to: "/auth", search: { mode: "login", next: "/settings?setup=1" } })} />
              ) : mode === "forgot" ? (
                <ForgotPasswordForm />
              ) : mode === "reset" ? (
                <ResetPasswordForm onDone={() => router.navigate({ to: "/auth", search: { mode: "login" } })} />
              ) : (
                <LoginForm onDone={goNext} />
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function ModeTab({
  to,
  current,
  children,
}: {
  to: "login" | "register";
  current: string;
  children: React.ReactNode;
}) {
  const active = to === current;
  return (
    <Link
      to="/auth"
      search={{ mode: to }}
      className={
        "auth-mode-tab flex-1 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] transition " +
        (active ? "auth-mode-tab-active" : "")
      }
    >
      {children}
    </Link>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="auth-input pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="auth-password-toggle absolute inset-y-0 right-0 flex items-center px-3 transition"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function LoginForm({ onDone }: { onDone: (isAdmin: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (error) return notifyUserError(error, "We couldn’t sign you in. Please try again.");
    toast.success("Welcome back!");
    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", signInData.user.id);
    if (roleError) {
      console.error("Could not check account role after sign in", roleError);
    }
    onDone((roles ?? []).some((role) => role.role === "admin"));
  };
  return (
    <form onSubmit={submit} className="auth-fields">
      <Field label="Email or Username">
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="auth-input" />
      </Field>
      <Field label="Password">
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <Link className="auth-forgot-link" to="/auth" search={{ mode: "forgot" }}>Forgot password?</Link>
      <Button type="submit" className="auth-submit w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });
    setBusy(false);
    if (error) return notifyUserError(error, "We couldn’t send a reset link. Please try again shortly.");
    setSent(true);
  };

  if (sent) {
    return (
      <div className="auth-fields">
        <p className="auth-reset-note">If an account exists for that email, a password reset link is on its way. Check your inbox and spam folder.</p>
        <Link className="auth-back-link" to="/auth" search={{ mode: "login" }}>Back to sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="auth-fields">
      <Field label="Email">
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="auth-input" />
      </Field>
      <Button type="submit" className="auth-submit w-full" disabled={busy}>
        {busy ? "Sending link…" : "Send reset link"}
      </Button>
      <Link className="auth-back-link" to="/auth" search={{ mode: "login" }}>Back to sign in</Link>
    </form>
  );
}

function ResetPasswordForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = strongPassword.safeParse(password);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Please choose a stronger password.");
    if (password !== confirmPassword) return toast.error("Passwords do not match.");

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return notifyUserError(error, "We couldn’t update your password. Request a new reset link and try again.");
    toast.success("Your password has been updated. You can now sign in.");
    await supabase.auth.signOut();
    onDone();
  };

  return (
    <form onSubmit={submit} className="auth-fields">
      <Field label="New password">
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password">
        <PasswordInput value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
      </Field>
      <Button type="submit" className="auth-submit w-full" disabled={busy}>
        {busy ? "Updating password…" : "Update password"}
      </Button>
      <Link className="auth-back-link" to="/auth" search={{ mode: "login" }}>Back to sign in</Link>
    </form>
  );
}

const PASSWORD_RULES = [
  { id: "len", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { id: "num", label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { id: "sym", label: "One special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72)
  .refine((p) => /[A-Z]/.test(p), "Password needs an uppercase letter")
  .refine((p) => /[a-z]/.test(p), "Password needs a lowercase letter")
  .refine((p) => /[0-9]/.test(p), "Password needs a number")
  .refine((p) => /[^A-Za-z0-9]/.test(p), "Password needs a special character");

const registerSchema = z
  .object({
    full_name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(255),
    phone_number: z.string().trim().regex(/^\+?[0-9]{9,15}$/, "Use 9–15 digits, optional + prefix"),
    gender: z.enum(["male", "female", "other"]),
    dob: z.string().refine((v) => {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
      return age >= 18 && age <= 100;
    }, "You must be 18 or older"),
    location: z.string().trim().min(2).max(80),
    bio: z.string().max(500).optional(),
    password: strongPassword,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

function RegisterForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    gender: "female" as "male" | "female" | "other",
    dob: "",
    location: "",
    bio: "",
    password: "",
    confirm_password: "",
  });
  const [busy, setBusy] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const ruleState = useMemo(
    () => PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(form.password) })),
    [form.password],
  );
  const strength = ruleState.filter((r) => r.ok).length;
  const confirmMismatch =
    form.confirm_password.length > 0 && form.password !== form.confirm_password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return toast.error(first?.message ?? "Please check your inputs");
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.full_name,
          phone_number: parsed.data.phone_number,
          gender: parsed.data.gender,
          dob: parsed.data.dob,
          location: parsed.data.location,
          bio: parsed.data.bio ?? "",
        },
      },
    });
    if (error) {
      setBusy(false);
      return notifyUserError(error, "We couldn’t create your account. Please try again.");
    }
    if (!data.session) {
      setBusy(false);
      return toast.error("Your account was created. Please check your email to finish setting it up.");
    }
    const { error: signOutError } = await supabase.auth.signOut();
    setBusy(false);
    if (signOutError) return notifyUserError(signOutError, "Your account was created, but we couldn’t finish signing you out. Please sign in to continue.");
    toast.success("Account created. Sign in to complete your profile.");
    onDone();
  };

  return (
    <form onSubmit={submit} className="auth-fields register-fields">
      <Field label="Full name" className="register-field">
        <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required />
      </Field>
      <Field label="Email" className="register-field">
        <Input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          required
          autoComplete="email"
        />
      </Field>
      <Field label="Phone number" className="register-field">
        <Input
          placeholder="+254712345678"
          value={form.phone_number}
          onChange={(e) => set("phone_number", e.target.value)}
          required
          autoComplete="tel"
        />
      </Field>
      <div className="register-field-wide register-pair">
        <Field label="Gender">
          <Select
            value={form.gender}
            onValueChange={(v) => set("gender", v as typeof form.gender)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date of birth">
          <Input
            type="date"
            value={form.dob}
            onChange={(e) => set("dob", e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label="Location" className="register-field">
        <Input
          placeholder="Nairobi, Kenya"
          value={form.location}
          onChange={(e) => set("location", e.target.value)}
          required
        />
      </Field>
      <Field label="Bio (optional)" className="register-field-wide">
        <Textarea
          rows={2}
          value={form.bio}
          onChange={(e) => set("bio", e.target.value)}
          placeholder="A line about you…"
        />
      </Field>
      <Field label="Password" className="register-field">
        <div onFocus={() => setPwFocused(true)}>
          <PasswordInput
            value={form.password}
            onChange={(v) => set("password", v)}
            autoComplete="new-password"
          />
        </div>
        {(pwFocused || form.password.length > 0) && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={
                    "h-1 flex-1 rounded-full transition-colors " +
                    (i < strength
                      ? strength <= 2
                        ? "bg-destructive"
                        : strength <= 4
                          ? "bg-yellow-500"
                          : "bg-emerald-500"
                      : "bg-muted")
                  }
                />
              ))}
            </div>
            <ul className="space-y-1 text-xs">
              <AnimatePresence initial={false}>
                {ruleState.map((r) => (
                  <motion.li
                    key={r.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={
                      "flex items-center gap-1.5 " +
                      (r.ok ? "text-emerald-600" : "text-muted-foreground")
                    }
                  >
                    {r.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                    {r.label}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        )}
      </Field>
      <Field label="Confirm password" className="register-field">
        <PasswordInput
          value={form.confirm_password}
          onChange={(v) => set("confirm_password", v)}
          autoComplete="new-password"
        />
        <AnimatePresence>
          {confirmMismatch && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-1 text-xs text-destructive"
            >
              Passwords do not match
            </motion.p>
          )}
          {!confirmMismatch && form.confirm_password.length > 0 && form.password.length > 0 && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-1 flex items-center gap-1 text-xs text-emerald-600"
            >
              <Check className="size-3.5" /> Passwords match
            </motion.p>
          )}
        </AnimatePresence>
      </Field>
      <Button type="submit" className="register-submit w-full gradient-romance text-primary-foreground" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
