import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicInfoPage } from "@/components/PublicInfoPage";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About NikahConnect" },
      {
        name: "description",
        content:
          "Learn about NikahConnect and our marriage-focused approach to Muslim matchmaking.",
      },
    ],
  }),
  component: () => (
    <PublicInfoPage
      eyebrow="Our approach"
      title="Meaningful Connections. Marriage with Purpose."
      intro="NikahConnect is a Kenya-first platform for Muslim adults who want to meet with marriage intentions."
    >
      <section>
        <h2>What guides us</h2>
        <p>
          We want introductions to begin with shared values, clear intentions, dignity, and mutual
          consent. Profiles describe what members choose to share; members decide for themselves
          what feels compatible.
        </p>
      </section>
      <section>
        <h2>How the current service works</h2>
        <p>
          Adults can create profiles, browse other members, express interest, and message after
          mutual interest. A free profile includes discovery and messaging. Premium starts at KES
          299 for 30 days, with a KES 799 option for unlimited contact reveals. Both include
          incoming-interest access and are paid manually through M-Pesa.
        </p>
        <p>
          NikahConnect does not provide religious rulings, verify religious suitability, or
          guarantee compatibility or marriage.
        </p>
      </section>
      <section>
        <h2>What is not available yet</h2>
        <p>
          Identity and phone verification, in-app wali or chaperone participation, and
          human-assisted matchmaking are not currently available. We do not display
          identity-verification badges.
        </p>
      </section>
      <p className="public-info-action">
        <Link to="/auth" search={{ mode: "register" } as never}>
          Create your profile
        </Link>
      </p>
    </PublicInfoPage>
  ),
});
