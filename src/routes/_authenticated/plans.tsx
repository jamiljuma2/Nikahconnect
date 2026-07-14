import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Infinity as InfIcon, Sparkles, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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
    <div className="pb-12">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="size-3.5" /> Choose your plan
        </span>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
          Reveal plans
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Unlock real phone numbers when you both feel ready. Pay securely with M-Pesa.
        </p>
      </motion.div>

      <AnimatePresence>
        {sub && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 rounded-2xl border border-border gradient-card p-5 shadow-card"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current plan
            </p>
            <p className="mt-1 font-display text-2xl font-semibold capitalize">{sub.plan}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {sub.is_unlimited
                ? "Unlimited reveals"
                : `${sub.remaining_reveals} reveal${sub.remaining_reveals === 1 ? "" : "s"} remaining`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {(Object.values(PLANS) as (typeof PLANS)[PlanId][]).map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.45, ease: "easeOut" }}
          >
            <PlanCard plan={p} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: (typeof PLANS)[PlanId] }) {
  const popular = plan.id === "standard";
  return (
    <motion.article
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className={
        "group relative flex h-full flex-col overflow-hidden rounded-3xl border p-6 shadow-card transition-shadow hover:shadow-romance " +
        (popular
          ? "border-primary/60 gradient-card shadow-romance"
          : "border-border bg-card")
      }
    >
      {popular && (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-primary/20 blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-romance px-3 py-1 text-xs font-medium text-primary-foreground shadow-romance">
            Most popular
          </span>
        </>
      )}
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          {plan.tagline}
        </p>
        <h3 className="mt-2 font-display text-3xl font-semibold">{plan.name}</h3>
        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">KES</span>
          <span className="font-display text-5xl font-semibold tracking-tight">{plan.price}</span>
        </div>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium">
          {plan.unlimited ? (
            <>
              <InfIcon className="size-3.5" /> Unlimited reveals
            </>
          ) : (
            <>{plan.reveals} reveals included</>
          )}
        </p>
      </div>
      <ul className="relative mt-6 flex-1 space-y-3 text-sm">
        {plan.features.map((f, i) => (
          <motion.li
            key={f}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className="flex items-start gap-2.5"
          >
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span className="text-foreground/90">{f}</span>
          </motion.li>
        ))}
      </ul>
      <PayDialog plan={plan} />
    </motion.article>
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
        <Button className="relative mt-6 w-full gradient-romance text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]">
          Choose {plan.name}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl gradient-romance text-primary-foreground shadow-romance">
              <Smartphone className="size-6" />
            </div>
            <DialogTitle className="text-center font-display text-2xl">
              Pay KES {plan.price} via M-Pesa
            </DialogTitle>
            <DialogDescription className="text-center">
              We'll send an STK prompt to your phone. Enter your M-Pesa PIN to complete.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{plan.name}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Reveals</span>
              <span className="font-medium">
                {plan.unlimited ? "Unlimited" : plan.reveals}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-display text-lg font-semibold">KES {plan.price}</span>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <Label htmlFor="phone">M-Pesa phone number</Label>
            <Input
              id="phone"
              placeholder="+254712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              className="h-11"
            />
            <Button
              onClick={pay}
              disabled={busy || phone.length < 10}
              className="h-11 w-full gradient-romance text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <AnimatePresence mode="wait" initial={false}>
                {busy ? (
                  <motion.span
                    key="busy"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-2"
                  >
                    <Loader2 className="size-4 animate-spin" /> Sending prompt…
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    Pay KES {plan.price}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" /> Secured by M-Pesa • No card required
            </p>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
