import { createFileRoute } from "@tanstack/react-router";
import { PublicInfoPage } from "@/components/PublicInfoPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — NikahConnect" },
      {
        name: "description",
        content:
          "What NikahConnect collects, how member information is used, and the privacy controls currently available.",
      },
    ],
  }),
  component: () => (
    <PublicInfoPage
      eyebrow="Privacy notice · 13 October 2026"
      title="Your information and your choices."
      intro="This notice describes the information handled by the current NikahConnect service. It is written to reflect the features that exist today."
    >
      <section>
        <h2>Information collected</h2>
        <p>
          When you register, the service receives your name, email address, phone number, gender,
          date of birth, general location, and password credentials managed by Supabase Auth. You
          may add a profile photo, biography, occupation, interests, and relationship goal. The
          service also stores likes, matches, messages, contact reveal records, payment references,
          amounts, plan type, and subscription status.
        </p>
      </section>
      <section>
        <h2>Why we use it</h2>
        <p>
          Account and profile data support sign-in, age eligibility, member discovery,
          mutual-interest matching, and messaging. Contact and payment data support requested phone
          reveals, payment confirmation through PayHero, subscription entitlements, fraud
          prevention, and accounting. We do not collect religious-practice or identity-document
          information in the current registration flow.
        </p>
      </section>
      <section>
        <h2>Who can see it</h2>
        <p>
          Signed-in members can see profile details shared for discovery, including name, age,
          gender, general location, photo, biography, occupation, interests, and relationship goal.
          Email addresses are not shown on member profiles. Phone numbers are held separately and
          are returned only after the member requesting a reveal has an eligible paid plan.
        </p>
        <p>
          Messages are available to the two participants in their matched conversation.
          Administrator tools do not provide a general message inbox. Payment processing uses
          PayHero; account, profile, and messaging infrastructure uses Supabase.
        </p>
        <p>
          Profile photos currently use public storage URLs. Someone who obtains a photo URL may be
          able to view that image outside the signed-in app. Do not upload an image you do not want
          accessible by URL.
        </p>
      </section>
      <section>
        <h2>Age and verification</h2>
        <p>
          Registration is limited to adults aged 18 and over. Date of birth is used to enforce age
          eligibility and calculate displayed age; the birth date itself is not part of the
          discovery profile. Identity and phone verification are not currently offered.
        </p>
      </section>
      <section>
        <h2>Retention and your choices</h2>
        <p>
          You can edit profile details, temporarily deactivate your account, or permanently delete
          it in Settings. Deactivation hides your profile from discovery. Permanent deletion removes
          account access, profile, photos, matches, and messages. Completed payment totals are
          retained for accounting after the account link and M-Pesa number are removed; pending
          payments are deleted.
        </p>
        <p>
          You may request access to or correction of your personal information and may object to
          processing where applicable. The service is intended to operate with applicable
          data-protection requirements, including Kenya’s Data Protection Act, 2019; this notice is
          not a statement of regulatory certification.
        </p>
      </section>
      <section>
        <h2>Service providers and location</h2>
        <p>
          Supabase and PayHero process information needed to provide authentication, database,
          storage, and payment services. Their infrastructure may process data in locations outside
          Kenya. The service does not claim that all data is hosted only in Kenya.
        </p>
      </section>
      <section>
        <h2>Privacy contact</h2>
        <p>
          The operator’s legal name and a dedicated privacy contact have not yet been provided for
          this notice. Add those details before treating this page as a final legal privacy notice.
        </p>
      </section>
    </PublicInfoPage>
  ),
});
