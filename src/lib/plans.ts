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
    name: "Standard",
    price: 499,
    reveals: 5,
    unlimited: false,
    tagline: "Most popular",
    features: ["5 contact reveals", "Unlimited matches & chats", "Priority support"],
  },
  premium: {
    id: "premium",
    name: "Premium",
    price: 1200,
    reveals: Number.POSITIVE_INFINITY,
    unlimited: true,
    tagline: "No limits",
    features: ["Unlimited contact reveals", "Unlimited matches & chats", "Premium badge"],
  },
};

export const planForAmount = (amount: number): PlanId | null => {
  if (amount === 249) return "starter";
  if (amount === 499) return "standard";
  if (amount === 1200) return "premium";
  return null;
};
