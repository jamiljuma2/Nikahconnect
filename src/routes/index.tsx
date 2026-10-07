import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ShieldCheck, MessageCircleHeart } from "lucide-react";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MingleConnect — Meaningful Dating in Kenya" },
      {
        name: "description",
        content:
          "Find real connections, match with people near you, and reveal contacts when you're ready. MingleConnect is dating built for intention.",
      },
      { property: "og:title", content: "MingleConnect — Meaningful Dating" },
      {
        property: "og:description",
        content: "Find real connections and reveal contacts on your terms.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="landing-page">
      <img
        src={heroImg}
        alt="Two people facing each other in warm sunset light"
        className="landing-hero-image"
        aria-hidden="true"
      />
      <div className="landing-image-wash" aria-hidden="true" />

      <nav className="landing-nav" aria-label="Main navigation">
        <Link to="/" className="landing-brand" aria-label="MingleConnect home">
          <span className="landing-brand-mark"><Heart className="size-4" fill="currentColor" /></span>
          <span>Mingle<span className="landing-brand-accent">Connect</span></span>
        </Link>
        <div className="landing-nav-copy">
          <span>Real people.</span>
          <span>Real connections.</span>
          <span className="landing-nav-accent">Real love.</span>
        </div>
        <Link to="/auth" search={{ mode: "login" } as never} className="landing-sign-in">
          Sign in
        </Link>
      </nav>

      <main className="landing-content">
        <p className="landing-eyebrow">MingleConnect / Dating with intention</p>
        <h1>
          <span>Two hearts.</span>
          <strong>One connection.</strong>
        </h1>
        <p className="landing-subtitle">
          Find someone who<br />
          truly understands you.
        </p>

        <div className="landing-benefits" aria-label="MingleConnect benefits">
          <LandingBenefit icon={<Heart />} lineOne="Meaningful" lineTwo="Matches" />
          <LandingBenefit icon={<ShieldCheck />} lineOne="Safe &" lineTwo="Secure" />
          <LandingBenefit icon={<MessageCircleHeart />} lineOne="Real" lineTwo="Conversations" />
        </div>

        <Link to="/auth" search={{ mode: "register" } as never} className="landing-cta">
          Join free today
        </Link>
        <p className="landing-microcopy">It only takes a minute <span aria-hidden="true">♥</span></p>
      </main>

      <aside className="landing-callout" aria-label="Your love story starts here">
        <span className="landing-callout-heart"><Heart fill="currentColor" /></span>
        <p>Your love story<br />starts here</p>
        <span className="landing-callout-rule" aria-hidden="true"><i /></span>
      </aside>
    </div>
  );
}

function LandingBenefit({
  icon,
  lineOne,
  lineTwo,
}: {
  icon: React.ReactNode;
  lineOne: string;
  lineTwo: string;
}) {
  return (
    <div className="landing-benefit">
      <span className="landing-benefit-icon">{icon}</span>
      <span>{lineOne}<br />{lineTwo}</span>
    </div>
  );
}
