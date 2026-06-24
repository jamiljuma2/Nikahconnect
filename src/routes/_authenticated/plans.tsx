import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Infinity as InfIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PLANS, type PlanId } from "@/lib/plans";
import { initiatePayment } from "@/lib/payments.functions";
import { getMyBalance } from "@/lib/dating.functions";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({ meta: [{ title: "Plans — MingleConnect" }] }),
  component: PlansPage,
});

function PlansPage() {
  const balanceQ = useQuery({ queryKey: ["balance"], queryFn: () => getMyBalance() });
  const sub = balanceQ.data?.subscription;
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold">Reveal plans</h1>
      <p className="mt-1 max-w-xl text-muted-foreground">
        Unlock real phone numbers when you both feel ready. Pay securely with M-Pesa.
      </p>

      {sub && (
        <div className="mt-6 rounded-2xl border border-border gradient-card p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Current plan</p>
          <p className="font-display text-2xl font-semibold capitalize">{sub.plan}</p>
          <p className="mt-1 text-sm">
            {sub.is_unlimited
              ? "Unlimited reveals"
              : `${sub.remaining_reveals} reveal${sub.remaining_reveals === 1 ? "" : "s"} remaining`}
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {(Object.values(PLANS) as (typeof PLANS)[PlanId][]).map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: (typeof PLANS)[PlanId] }) {
  const popular = plan.id === "standard";
  return (
    <article
      className={
        "relative flex flex-col rounded-3xl border p-6 shadow-card " +
        (popular ? "border-primary gradient-card shadow-romance" : "border-border bg-card")
      }
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-romance px-3 py-1 text-xs font-medium text-primary-foreground">
          Most popular
        </span>
      )}
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">{plan.tagline}</p>
        <h3 className="mt-2 font-display text-3xl font-semibold">{plan.name}</h3>
        <p className="mt-3 font-display text-5xl font-semibold">
          <span className="text-base font-sans text-muted-foreground">KES </span>
          {plan.price}
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium">
          {plan.unlimited ? (
            <>
              <InfIcon className="size-4" /> Unlimited reveals
            </>
          ) : (
            <>{plan.reveals} reveals</>
          )}
        </p>
      </div>
      <ul className="mt-5 flex-1 space-y-2 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 text-primary" />
            {f}
          </li>
        ))}
      </ul>
      <PayDialog plan={plan} />
    </article>
  );
}

function PayDialog({ plan }: { plan: (typeof PLANS)[PlanId] }) {
  const initiate = useServerFn(initiatePayment);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());

  const pay = async () => {
    setBusy(true);
    try {
      const r = await initiate({
        data: { planId: plan.id, mpesaPhone: phone, idempotencyKey: idemKey },
      });
      toast.success(
        r.idempotent
          ? "Payment already in progress — check your phone."
          : "Check your phone — enter your M-Pesa PIN to confirm.",
      );
      setOpen(false);
      // Fresh key for the next independent attempt
      setIdemKey(crypto.randomUUID());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="mt-6 w-full gradient-romance text-primary-foreground">
          Choose {plan.name}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay KES {plan.price} via M-Pesa</DialogTitle>
          <DialogDescription>
            We'll send an STK prompt to your phone. Enter your M-Pesa PIN to complete.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="phone">M-Pesa phone number</Label>
          <Input
            id="phone"
            placeholder="+254712345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button
            onClick={pay}
            disabled={busy || phone.length < 10}
            className="w-full gradient-romance text-primary-foreground"
          >
            {busy ? "Sending…" : `Pay KES ${plan.price}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
