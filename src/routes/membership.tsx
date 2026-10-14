import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicInfoPage } from "@/components/PublicInfoPage";
import { AVAILABLE_PLANS } from "@/lib/plans";

export const Route = createFileRoute("/membership")({
  head: () => ({
    meta: [
      { title: "Membership and Pricing — NikahConnect" },
      {
        name: "description",
        content:
          "Understand free membership and monthly Premium pricing on NikahConnect.",
      },
    ],
  }),
  component: () => (
    <PublicInfoPage
      eyebrow="Membership"
      title="Start free. Upgrade when it suits you."
      intro="Creating a profile, browsing, expressing interest, and messaging after a mutual match are free. Premium adds access to incoming interests and contact reveals."
    >
      <section className="public-info-plan-grid" aria-label="Premium membership plans">
        {AVAILABLE_PLANS.map((plan) => (
          <article className="public-info-plan" key={plan.id}>
            <h2>{plan.name}</h2>
            <p className="public-info-price">KES {plan.price.toLocaleString("en-KE")}</p>
            <p>Per month · 30 days of access</p>
            <p>{plan.unlimited ? "See incoming interests and reveal unlimited contacts" : "See incoming interests and get 5 contact reveals"}</p>
          </article>
        ))}
      </section>
      <section>
        <h2>Payments and renewals</h2>
        <p>
          Payments use M-Pesa through PayHero. Premium is paid monthly by starting a new payment
          manually; there is no automatic charge or recurring payment authorization. Check the plan
          and amount shown at checkout before paying. No assisted matchmaking service is currently
          offered.
        </p>
        <p>
          For a payment that has not appeared, return to the Plans page while signed in so the
          payment status can be checked with the provider.
        </p>
      </section>
      <p className="public-info-action">
        <Link to="/auth" search={{ mode: "register" } as never}>
          Create your free profile
        </Link>
      </p>
    </PublicInfoPage>
  ),
});
