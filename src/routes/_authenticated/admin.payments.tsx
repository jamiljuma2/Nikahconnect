import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkIsAdmin } from "@/lib/admin.functions";
import { getPayheroSettings, savePayheroSettings } from "@/lib/payhero-settings.functions";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({
    meta: [
      { title: "Payment settings — MingleConnect" },
      { name: "description", content: "Connect and verify your PayHero M-Pesa account." },
      { property: "og:title", content: "Payment settings — MingleConnect" },
      { property: "og:description", content: "Connect and verify your PayHero M-Pesa account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    try {
      const { isAdmin } = await checkIsAdmin();
      if (!isAdmin) throw redirect({ to: "/discover" });
    } catch (e) {
      if ((e as { isRedirect?: boolean }).isRedirect) throw e;
      throw redirect({ to: "/discover" });
    }
  },
  component: PaymentSettingsPage,
});

function PaymentSettingsPage() {
  const getSettings = useServerFn(getPayheroSettings);
  const save = useServerFn(savePayheroSettings);
  const q = useQuery({ queryKey: ["payhero-settings"], queryFn: () => getSettings() });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [channelId, setChannelId] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ data: { apiUsername: username, apiPassword: password, channelId } });
      toast.success("PayHero connected and verified");
      setPassword("");
      q.refetch();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const s = q.data;

  return (
    <div className="mx-auto max-w-xl px-4 py-8 pb-28">
      <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to admin
      </Link>
      <h1 className="font-display text-3xl font-semibold">Payment settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect your PayHero account so members can pay with M-Pesa.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : q.isError ? (
          <div className="admin-payment-error" role="alert">
            <p>Payment settings couldn’t load.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void q.refetch()}>Try again</Button>
          </div>
        ) : s?.configured ? (
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 text-primary" />
            <div className="text-sm">
              <p className="font-medium">Connected</p>
              <p className="text-muted-foreground">
                Username {s.usernameMasked} · Channel {s.channelId}
              </p>
              {s.verifiedAt && (
                <p className="text-muted-foreground">
                  Verified {new Date(s.verifiedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not connected yet.</p>
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="space-y-1.5">
          <Label htmlFor="ph-user">API Username</Label>
          <Input id="ph-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ph-pass">API Password</Label>
          <div className="relative">
            <Input
              id="ph-pass"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ph-channel">Channel ID</Label>
          <Input
            id="ph-channel"
            inputMode="numeric"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value.replace(/\D/g, ""))}
            required
          />
          <p className="text-xs text-muted-foreground">Found under Payment Channels in your PayHero dashboard.</p>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <><Loader2 className="mr-2 size-4 animate-spin" /> Checking with PayHero…</> : "Test & save"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Your details are checked with PayHero first and only saved if they work. They're stored securely on the server and never shown again.
        </p>
      </form>
    </div>
  );
}
