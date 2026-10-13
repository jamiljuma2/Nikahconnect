export type PlanId = "starter" | "standard" | "premium";

export interface Plan {
  id: PlanId;
  name: string;
  price: number; // KES
  reveals: number;
  unlimited: boolean;
  tagline: string;
  features: string[];
}

// Plan IDs remain stable for historical payments. Standard and premium are
// currently available for new purchases; starter remains legacy-only.
export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 249,
    reveals: 3,
    unlimited: false,
    tagline: "Try it out",
    features: ["3 contact reveals", "Unlimited matches & chats", "Valid for 30 days"],
  },
  standard: {
    id: "standard",
    name: "Premium Membership",
    price: 299,
    reveals: 5,
    unlimited: false,
    tagline: "More ways to connect",
    features: ["See incoming interests", "5 contact reveals", "30 days of premium access"],
  },
  premium: {
    id: "premium",
    name: "Premium Unlimited",
    price: 799,
    reveals: Number.POSITIVE_INFINITY,
    unlimited: true,
    tagline: "Unlimited contact reveals",
    features: ["Unlimited contact reveals", "See incoming interests", "30 days of premium access"],
  },
};

export const AVAILABLE_PLANS: Plan[] = [PLANS.standard, PLANS.premium];

export const planForAmount = (amount: number): PlanId | null => {
  if (amount === 249) return "starter";
  if (amount === 299 || amount === 499) return "standard";
  if (amount === 799 || amount === 999 || amount === 1200) return "premium";
  return null;
};
