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
import { Heart, Eye, EyeOff, Check, X } from "lucide-react";

const search = z.object({
  mode: z.enum(["login", "register"]).default("login"),
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
  const goNext = () => {
    if (nextPath) {
      window.location.assign(nextPath);
    } else {
      router.navigate({ to: "/discover" });
    }
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="relative hidden gradient-romance md:flex">
        <div className="m-auto max-w-sm p-12 text-primary-foreground">
          <Heart className="size-10" />
          <h2 className="mt-6 font-display text-4xl font-semibold leading-tight">
            Real people. Real sparks. Real numbers — only when you both decide.
          </h2>
          <p className="mt-4 text-sm opacity-90">
            Welcome to MingleConnect. Join thousands finding meaningful connections near you.
          </p>
        </div>
      </aside>

      <main className="flex flex-col justify-center px-6 py-12 md:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="font-display text-2xl font-semibold">
            Mingle<span className="text-primary">Connect</span>
          </Link>
          <h1 className="mt-8 font-display text-4xl font-semibold">
            {mode === "register" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "register"
              ? "It only takes a minute. Email verification is required."
              : "Sign in to continue your story."}
          </p>

          <div className="mt-6 flex gap-2 rounded-full bg-muted p-1">
            <ModeTab to="login" current={mode}>Sign in</ModeTab>
            <ModeTab to="register" current={mode}>Register</ModeTab>
          </div>

          <div className="mt-6">
            {mode === "register" ? (
              <RegisterForm nextPath={nextPath} onDone={() => router.navigate({ to: "/auth", search: nextPath ? { mode: "login", next: nextPath } : { mode: "login" } })} />
            ) : (
              <LoginForm onDone={goNext} />
            )}
          </div>
        </div>
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
        "flex-1 rounded-full px-4 py-2 text-center text-sm font-medium transition " +
        (active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
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
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email">
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </Field>
      <Field label="Password">
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <Button type="submit" className="w-full gradient-romance text-primary-foreground" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
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

function RegisterForm({ onDone, nextPath }: { onDone: () => void; nextPath: string | null }) {
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
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}${nextPath ?? "/discover"}`,
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
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to verify your account.");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Full name">
        <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          required
          autoComplete="email"
        />
      </Field>
      <Field label="Phone number">
        <Input
          placeholder="+254712345678"
          value={form.phone_number}
          onChange={(e) => set("phone_number", e.target.value)}
          required
          autoComplete="tel"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
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
      <Field label="Location">
        <Input
          placeholder="Nairobi, Kenya"
          value={form.location}
          onChange={(e) => set("location", e.target.value)}
          required
        />
      </Field>
      <Field label="Bio (optional)">
        <Textarea
          rows={3}
          value={form.bio}
          onChange={(e) => set("bio", e.target.value)}
          placeholder="A line about you…"
        />
      </Field>
      <Field label="Password">
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
      <Field label="Confirm password">
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
      <Button type="submit" className="w-full gradient-romance text-primary-foreground" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
