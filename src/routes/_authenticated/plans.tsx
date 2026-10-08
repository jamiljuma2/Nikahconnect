import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
import { getMyPayments, initiatePayment, verifyAndActivatePayment } from "@/lib/payments.functions";
import { getMyBalance } from "@/lib/dating.functions";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({
    meta: [
      { title: "Reveal Plans — MingleConnect" },
      {
        name: "description",
        content: "Choose a MingleConnect reveal plan and activate phone number reveals with M-Pesa.",
      },
      { property: "og:title", content: "Reveal Plans — MingleConnect" },
      {
        property: "og:description",
        content: "Choose a MingleConnect reveal plan and activate phone number reveals with M-Pesa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  const verify = useServerFn(verifyAndActivatePayment);
  const qc = useQueryClient();
  const checkedPendingRef = useRef(false);
  const balanceQ = useQuery({ queryKey: ["balance"], queryFn: () => getMyBalance() });
  const paymentsQ = useQuery({ queryKey: ["payments"], queryFn: () => getMyPayments() });
  const sub = balanceQ.data?.subscription;

  useEffect(() => {
    if (checkedPendingRef.current || sub || !paymentsQ.data?.payments?.length) return;

    const pending = paymentsQ.data.payments.find((p) => p.status === "pending" && p.transaction_id);
    if (!pending?.transaction_id) return;

    checkedPendingRef.current = true;
    void verify({ data: { transactionId: pending.transaction_id } })
      .then((r) => {
        if (r.status === "success" && r.activated) {
          qc.invalidateQueries({ queryKey: ["balance"] });
          qc.invalidateQueries({ queryKey: ["payments"] });
          toast.success("Your paid plan is active — number reveals are ready.");
        }
      })
      .catch((e) => {
        checkedPendingRef.current = false;
        console.error("pending payment recovery", e);
      });
  }, [paymentsQ.data?.payments, qc, sub, verify]);

  return (
    <div className="plans-page">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="plans-heading"
      >
        <span className="plans-kicker">
          <Sparkles className="size-3.5" /> MingleConnect membership
        </span>
        <h1>Simple, transparent pricing</h1>
        <p>Choose the reveal plan that fits your pace. Every plan includes secure M-Pesa checkout.</p>
      </motion.div>

      <AnimatePresence>
        {sub && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.1 }}
            className="plans-current-plan"
          >
            <div>
              <p className="plans-current-label">Current plan</p>
              <p className="plans-current-name">{sub.plan}</p>
            </div>
            <p className="plans-current-balance">
              {sub.is_unlimited
                ? "Unlimited reveals"
                : `${sub.remaining_reveals} reveal${sub.remaining_reveals === 1 ? "" : "s"} remaining`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="plans-grid">
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
        "plans-card group relative flex h-full flex-col " +
        (popular ? "plans-card-popular" : "")
      }
    >
      {popular && (
        <>
          <motion.div
            aria-hidden
            className="plans-card-glow pointer-events-none absolute"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="plans-popular-badge">
            Most popular · Best value
          </span>
        </>
      )}
      <div className="plans-card-top relative">
        <p className="plans-card-tagline">{plan.tagline}</p>
        <h3>{plan.name}</h3>
        <div className="plans-price">
          <span>KES</span>
          <strong>{plan.price.toLocaleString("en-KE")}</strong>
        </div>
        <p className="plans-duration">30-day access · {plan.unlimited ? "Unlimited reveals" : `${plan.reveals} reveals`}</p>
        <p className="plans-condition">
          {plan.unlimited ? (
            <>
              <InfIcon className="size-4" /> No reveal limit
            </>
          ) : (
            <><Check className="size-4" /> {plan.reveals} contact reveals included</>
          )}
        </p>
      </div>
      <ul className="plans-features relative flex-1">
        {plan.features.map((f, i) => (
          <motion.li
            key={f}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className="flex items-start gap-2.5"
          >
            <span className="plans-feature-check">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            <span>{f}</span>
          </motion.li>
        ))}
      </ul>
      <PayDialog plan={plan} />
    </motion.article>
  );
}

function PayDialog({ plan }: { plan: (typeof PLANS)[PlanId] }) {
  const initiate = useServerFn(initiatePayment);
  const verify = useServerFn(verifyAndActivatePayment);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  let normalizedPhone = phone.replace(/\D/g, "");
  if (normalizedPhone.startsWith("0")) normalizedPhone = `254${normalizedPhone.slice(1)}`;
  else if (normalizedPhone.startsWith("7") || normalizedPhone.startsWith("1")) normalizedPhone = `254${normalizedPhone}`;
  const invalidPhone = phone.length >= 10 && !/^254[17]\d{8}$/.test(normalizedPhone);

  const stopPolling = () => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollActivation = (transactionId: string) => {
    setWaiting(true);
    const started = Date.now();
    const tick = async () => {
      try {
        const r = await verify({ data: { transactionId } });
        if (r.status === "success" && r.activated) {
          stopPolling();
          setWaiting(false);
          setOpen(false);
          setIdemKey(crypto.randomUUID());
          qc.invalidateQueries({ queryKey: ["balance"] });
          toast.success(`${plan.name} activated — your reveals are ready.`);
          return;
        }
        if (r.status === "failed") {
          stopPolling();
          setWaiting(false);
          toast.error("Payment was cancelled or failed. Please try again.");
          return;
        }
      } catch (e) {
        console.error("verify poll", e);
      }
      // Give up after ~2 minutes so users aren't stuck.
      if (Date.now() - started > 120_000) {
        stopPolling();
        setWaiting(false);
        toast.info(
          "Still waiting for M-Pesa confirmation. If you paid, refresh this page in a moment.",
        );
        return;
      }
      pollRef.current = setTimeout(tick, 3000);
    };
    void tick();
  };

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
      if (r.transactionId) {
        pollActivation(r.transactionId);
      } else {
        setOpen(false);
        setIdemKey(crypto.randomUUID());
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          stopPolling();
          setWaiting(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="relative mt-6 w-full gradient-romance text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]">
          Choose {plan.name}
        </Button>
      </DialogTrigger>
      <DialogContent className="mpesa-dialog-content" overlayClassName="mpesa-dialog-overlay">
        <motion.div
          className="mpesa-dialog-inner"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <DialogHeader className="mpesa-dialog-header">
            <div className="mpesa-payment-icon">
              <Smartphone className="size-6" />
            </div>
            <DialogTitle className="mpesa-dialog-title">
              Pay KES {plan.price} via M-Pesa
            </DialogTitle>
            <DialogDescription className="mpesa-dialog-description">
              We'll send an STK prompt to your phone. Enter your M-Pesa PIN to complete.
            </DialogDescription>
          </DialogHeader>
          <div className="mpesa-plan-summary">
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
            <div className="mpesa-total-row">
              <span className="text-muted-foreground">Total</span>
              <span>KES {plan.price}</span>
            </div>
          </div>
          <div className="mpesa-payment-form">
            <Label htmlFor="phone" className="mpesa-phone-label">M-Pesa phone number</Label>
            <Input
              id="phone"
              placeholder="+254 712 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={invalidPhone}
              aria-describedby={invalidPhone ? "mpesa-phone-error" : undefined}
              className={`mpesa-phone-input${invalidPhone ? " invalid" : ""}`}
            />
            {invalidPhone && <p id="mpesa-phone-error" className="mpesa-phone-error" role="alert">Enter a valid Safaricom number, such as 0712345678.</p>}
            <Button
              onClick={pay}
              disabled={busy || waiting || phone.length < 10}
              className="mpesa-pay-button"
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
                    <Loader2 className="size-4 animate-spin" /> Processing…
                  </motion.span>
                ) : waiting ? (
                  <motion.span
                    key="waiting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="inline-flex items-center gap-2"
                  >
                    <Loader2 className="size-4 animate-spin" /> Waiting for M-Pesa…
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
            {waiting && (
              <p className="mpesa-waiting-note" role="status" aria-live="polite">
                Approve the M-Pesa prompt on your phone. Your plan activates automatically.
              </p>
            )}
            <p className="mpesa-security-note">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> Secured by M-Pesa • No card required
            </p>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
