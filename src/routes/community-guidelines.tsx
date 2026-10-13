import { createFileRoute } from "@tanstack/react-router";
import { PublicInfoPage } from "@/components/PublicInfoPage";

export const Route = createFileRoute("/community-guidelines")({
  head: () => ({
    meta: [
      { title: "Community Guidelines — NikahConnect" },
      {
        name: "description",
        content: "Guidance for respectful, marriage-minded participation on NikahConnect.",
      },
    ],
  }),
  component: () => (
    <PublicInfoPage
      eyebrow="Community guidelines"
      title="Meet one another with dignity."
      intro="NikahConnect is for adults exploring marriage-minded connections. Treat every person as an individual with their own boundaries and choices."
    >
      <section>
        <h2>Be honest about who you are</h2>
        <p>
          Use current, truthful profile details and photos that represent you. Do not impersonate
          others, misrepresent your intentions, or use another person’s image without permission.
        </p>
      </section>
      <section>
        <h2>Respect consent and boundaries</h2>
        <p>
          Interest must be mutual. Accept a no, a pause, or an end to a conversation. Do not
          pressure anyone to share a phone number, private image, money, or sensitive personal
          details.
        </p>
      </section>
      <section>
        <h2>Communicate thoughtfully</h2>
        <p>
          Discuss values, marriage expectations, family responsibilities, future plans, and
          practical compatibility with courtesy. NikahConnect supports conversation; it does not
          certify that every interaction is religiously appropriate.
        </p>
      </section>
      <section>
        <h2>Protect privacy and safety</h2>
        <p>
          Do not publish another member’s messages, contact details, or photos without permission.
          Be cautious with requests for money and move at a pace that feels safe. If you feel at
          risk, end the conversation and seek help from people you trust.
        </p>
      </section>
      <section>
        <h2>Report and enforcement</h2>
        <p>
          Dedicated in-app reporting and blocking tools are not yet available. If someone threatens
          or harms you, stop responding and use the support contact supplied by the service operator
          when it becomes available. Accounts may be restricted for serious misuse, but there is not
          yet a self-service appeal workflow.
        </p>
      </section>
    </PublicInfoPage>
  ),
});
