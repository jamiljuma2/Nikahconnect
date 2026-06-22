import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
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
import { Heart } from "lucide-react";

const search = z.object({ mode: z.enum(["login", "register"]).default("login") });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — MingleConnect" },
      { name: "description", content: "Sign in or create your MingleConnect account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const router = useRouter();

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
              <RegisterForm onDone={() => router.navigate({ to: "/auth" })} />
            ) : (
              <LoginForm onDone={() => router.navigate({ to: "/discover" })} />
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
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password">
        <Input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Button type="submit" className="w-full gradient-romance text-primary-foreground" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

const registerSchema = z.object({
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
  password: z.string().min(8).max(72),
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
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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
        emailRedirectTo: `${window.location.origin}/discover`,
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
        />
      </Field>
      <Field label="Phone number">
        <Input
          placeholder="+254712345678"
          value={form.phone_number}
          onChange={(e) => set("phone_number", e.target.value)}
          required
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
        <Input
          type="password"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          required
        />
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
