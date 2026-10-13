import { createFileRoute } from "@tanstack/react-router";
import { PublicInfoPage } from "@/components/PublicInfoPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — NikahConnect" },
      {
        name: "description",
        content: "Terms for using the NikahConnect Muslim marriage and matchmaking service.",
      },
    ],
  }),
  component: () => (
    <PublicInfoPage
      eyebrow="Terms of service · 13 October 2026"
      title="Use NikahConnect with care."
      intro="These terms describe the current service and the responsibilities that come with using it."
    >
      <section>
        <h2>Eligibility and account</h2>
        <p>
          You must be at least 18 to create an account. Keep your login credentials secure, provide
          accurate information, and update your profile when it changes. One person may not
          impersonate another or create misleading profiles.
        </p>
      </section>
      <section>
        <h2>Respectful use</h2>
        <p>
          Use the service to meet adults with marriage intentions. Do not harass, threaten, coerce,
          scam, impersonate, discriminate against, or share another member’s personal information
          without permission. Do not use the platform to send unsolicited advertising or unlawful
          content.
        </p>
      </section>
      <section>
        <h2>Profiles, discovery, and messages</h2>
        <p>
          You control the profile information you submit. Profile information is shown to signed-in
          members for discovery. Messaging becomes available after mutual interest. Members are
          responsible for deciding whether another person is compatible and how to continue a
          conversation. NikahConnect does not guarantee identity, religious suitability,
          compatibility, or marriage.
        </p>
      </section>
      <section>
        <h2>Payments</h2>
        <p>
          Creating a profile and using basic discovery and messaging are free. Paid contact reveal
          plans are one-time M-Pesa purchases, currently valid for 30 days, and do not automatically
          renew. A successful payment is confirmed server-side with PayHero before an entitlement is
          activated. Prices and reveal amounts are shown on the Plans page before purchase. Assisted
          matchmaking is not currently offered.
        </p>
      </section>
      <section>
        <h2>Account actions and availability</h2>
        <p>
          You may deactivate or delete your account from Settings. We may restrict accounts that
          breach these terms or threaten the safety of other members. The service may change as
          features are improved; we will describe paid features accurately when they are offered.
        </p>
      </section>
      <section>
        <h2>Religious transparency</h2>
        <p>
          NikahConnect is not presented as a religious authority and does not issue religious
          rulings or certify that an interaction is halal. Members choose how to involve family and
          qualified religious advisers in their own decisions.
        </p>
      </section>
      <section>
        <h2>Operator and contact details</h2>
        <p>
          The legal operator name and service contact details have not yet been provided. Add those
          details before treating these terms as final legal terms.
        </p>
      </section>
    </PublicInfoPage>
  ),
});
