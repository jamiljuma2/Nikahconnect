import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookHeart,
  CircleCheck,
  HeartHandshake,
  LockKeyhole,
  MessageCircleHeart,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

const siteUrl = "https://www.mingleconnect.co.ke";
const description =
  "Discover meaningful Muslim connections through marriage-focused matchmaking built around compatibility, trust, and shared values.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NikahConnect — Muslim Marriage & Matchmaking" },
      { name: "description", content: description },
      { name: "theme-color", content: "#f8f6ee" },
      { property: "og:url", content: `${siteUrl}/` },
      { property: "og:title", content: "NikahConnect — Muslim Marriage & Matchmaking" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "NikahConnect" },
      { property: "og:image", content: `${siteUrl}/og/nikahconnect-social.png` },
      {
        property: "og:image:alt",
        content: "NikahConnect — Meaningful Connections. Marriage with Purpose.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "NikahConnect — Muslim Marriage & Matchmaking" },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: `${siteUrl}/og/nikahconnect-social.png` },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "NikahConnect",
          url: `${siteUrl}/`,
          logo: `${siteUrl}/icons/nikahconnect-512.png`,
          description,
        },
      },
    ],
    links: [{ rel: "canonical", href: `${siteUrl}/` }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link to="/" className="landing-brand" aria-label="NikahConnect home">
          <BrandLogo className="landing-brand-logo" />
        </Link>
        <nav className="landing-nav-links" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#our-values">Our values</a>
          <a href="#membership">Membership</a>
        </nav>
        <Link to="/auth" search={{ mode: "login" } as never} className="landing-sign-in">
          Sign in <ArrowRight aria-hidden="true" />
        </Link>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-copy">
            <p className="landing-eyebrow">
              <span /> MARRIAGE WITH PURPOSE
            </p>
            <h1 id="landing-title">Find a Partner Who Shares Your Values.</h1>
            <p className="landing-subtitle">
              Discover meaningful Muslim connections built around compatibility, trust, and marriage
              intentions.
            </p>
            <div className="landing-actions">
              <Link to="/auth" search={{ mode: "register" } as never} className="landing-cta">
                Create Your Profile <ArrowRight aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="landing-secondary-cta">
                How It Works
              </a>
            </div>
            <p className="landing-join-note">For adults 18 and over · Start with a free profile</p>
          </div>

          <div className="landing-visual" aria-label="A thoughtful start to a new chapter">
            <div className="landing-arch-art" aria-hidden="true">
              <div className="landing-art-sun" />
              <div className="landing-art-arch">
                <div />
              </div>
              <span className="landing-art-star landing-art-star-one">✦</span>
              <span className="landing-art-star landing-art-star-two">✧</span>
              <div className="landing-art-caption">
                <span className="landing-art-icon">
                  <HeartHandshake size={19} />
                </span>
                <span>
                  <strong>Start with shared values</strong>
                  <small>Move at a pace that feels right</small>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-values" id="our-values" aria-label="What guides NikahConnect">
          <LandingValue
            icon={<ShieldCheck />}
            title="Respect and dignity"
            detail="Considerate introductions"
          />
          <LandingValue
            icon={<HeartHandshake />}
            title="Marriage intentions"
            detail="Say what you are looking for"
          />
          <LandingValue
            icon={<LockKeyhole />}
            title="Privacy in your control"
            detail="Choose what you share"
          />
          <LandingValue
            icon={<UsersRound />}
            title="Family values"
            detail="Involve trusted family at your pace"
          />
        </section>

        <section className="landing-section landing-how" id="how-it-works">
          <div className="landing-section-heading">
            <p className="landing-section-kicker">A thoughtful way to meet</p>
            <h2>Begin with what matters to you.</h2>
            <p>
              Build a profile around your intentions, get to know members through mutual interest,
              and decide together how to continue.
            </p>
          </div>
          <div className="landing-steps">
            <Step
              number="01"
              icon={<BookHeart />}
              title="Share your story"
              detail="Add a profile photo, general location, interests, work, and the relationship intention you choose to share."
            />
            <Step
              number="02"
              icon={<Sparkles />}
              title="Explore with care"
              detail="Browse member profiles and decide for yourself when you would like to express interest."
            />
            <Step
              number="03"
              icon={<MessageCircleHeart />}
              title="Talk with intention"
              detail="A mutual interest opens a private conversation. Take time to discuss what matters."
            />
          </div>
        </section>

        <section className="landing-section landing-trust" id="privacy">
          <div className="landing-trust-mark">
            <LockKeyhole size={28} strokeWidth={1.6} />
          </div>
          <div>
            <p className="landing-section-kicker">Trust through honesty</p>
            <h2>Your information deserves care.</h2>
            <p>
              Your email and phone number are not shown on your public member profile. Phone contact
              details are shared only through the existing paid contact reveal feature. Member
              profiles are for signed-in users; they are not listed in the public sitemap.
            </p>
            <p className="landing-trust-note">
              <CircleCheck size={15} /> Identity and phone verification are not currently offered,
              so no verification badges are shown.
            </p>
          </div>
        </section>

        <section className="landing-section landing-family" id="family">
          <div className="landing-family-copy">
            <p className="landing-section-kicker">Family, at your pace</p>
            <h2>Keep the people you trust close.</h2>
            <p>
              Many people choose to involve family in the marriage process. You can share what feels
              appropriate with your family as you get to know a member.
            </p>
            <p className="landing-feature-status">
              In-app wali or chaperone participation is not available yet.
            </p>
          </div>
          <div className="landing-family-art" aria-hidden="true">
            <UsersRound size={46} strokeWidth={1.3} />
            <span>Good conversations make room for the people who matter.</span>
          </div>
        </section>

        <section className="landing-section landing-membership" id="membership">
          <div className="landing-section-heading">
            <p className="landing-section-kicker">Clear and simple</p>
            <h2>Start free. Choose extras only if you need them.</h2>
            <p>
              Creating a profile, browsing, liking, and mutual-match messaging are free. Paid plans
              currently add phone contact reveals.
            </p>
          </div>
          <div className="landing-membership-note">
            <span>
              <strong>Contact reveal plans</strong>
              <small>One-time payments through M-Pesa · 30 days · no automatic renewal</small>
            </span>
            <Link to="/auth" search={{ mode: "register" } as never}>
              See plans after joining <ArrowRight size={16} />
            </Link>
          </div>
          <p className="landing-plan-note">
            Assisted matchmaking is not currently offered. Membership details and prices are shown
            before payment.
          </p>
        </section>

        <section className="landing-section landing-faq" id="faq">
          <div className="landing-section-heading">
            <p className="landing-section-kicker">Good to know</p>
            <h2>Questions, answered.</h2>
          </div>
          <div className="landing-faq-list">
            <details>
              <summary>Who can join NikahConnect?</summary>
              <p>
                Adults aged 18 or over who are interested in meeting someone with marriage
                intentions. You can sign up from Kenya or elsewhere.
              </p>
            </details>
            <details>
              <summary>Is membership automatically renewed?</summary>
              <p>
                No. Current contact reveal plans are one-time payments with a 30-day term. They do
                not automatically renew.
              </p>
            </details>
            <details>
              <summary>Are profiles or identities verified?</summary>
              <p>
                Identity and phone verification are not currently offered. We do not label members
                as identity-verified.
              </p>
            </details>
            <details>
              <summary>Does NikahConnect calculate a compatibility score?</summary>
              <p>
                No compatibility score is currently calculated. Members review the profile details
                shared on the platform and decide what feels compatible to them.
              </p>
            </details>
            <details>
              <summary>Can a wali join a conversation?</summary>
              <p>
                In-app wali or chaperone participation is not available yet. Members may involve
                family outside the platform at their discretion.
              </p>
            </details>
            <details>
              <summary>Does NikahConnect guarantee compatibility or marriage?</summary>
              <p>
                No. The service can help people discover shared interests and start conversations,
                but it cannot guarantee compatibility or a marriage outcome.
              </p>
            </details>
          </div>
        </section>

        <section className="landing-final-cta">
          <p className="landing-section-kicker">A new chapter can start thoughtfully</p>
          <h2>
            Meaningful Connections.
            <br />
            Marriage with Purpose.
          </h2>
          <Link to="/auth" search={{ mode: "register" } as never} className="landing-cta">
            Create Your Profile <ArrowRight aria-hidden="true" />
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <BrandLogo className="landing-footer-logo" />
        <span>© {new Date().getFullYear()} NikahConnect</span>
        <nav aria-label="Legal and support links">
          <Link to="/about">About</Link>
          <Link to="/membership">Membership</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/community-guidelines">Community Guidelines</Link>
        </nav>
      </footer>
    </div>
  );
}

function LandingValue({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="landing-value">
      <span className="landing-value-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </div>
  );
}

function Step({
  number,
  icon,
  title,
  detail,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <article className="landing-step">
      <div className="landing-step-top">
        <span>{number}</span>
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
    </article>
  );
}
