import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Heart, MessageCircle, Search, UsersRound } from "lucide-react";
import heroImg from "@/assets/landing-couple.png";
import { BrandLogo } from "@/components/BrandLogo";

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
      <header className="landing-nav">
        <Link to="/" className="landing-brand" aria-label="MingleConnect home">
          <BrandLogo className="landing-brand-logo" />
        </Link>
        <Link to="/auth" search={{ mode: "login" } as never} className="landing-sign-in">
          Sign in
        </Link>
      </header>

      <main className="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <img src={heroImg} alt="" className="landing-hero-image" />
          <div className="landing-copy">
            <p className="landing-eyebrow">REAL PEOPLE <i /> REAL CONNECTIONS <i /> DATING WITH INTENTION</p>
            <h1 id="landing-title">Meet <em>New</em><br />People<span className="landing-title-heart">♥</span></h1>
            <p className="landing-subtitle">
              New people. New conversations.<br />Maybe something <em>more...</em>
            </p>
            <div className="landing-actions">
              <Link to="/auth" search={{ mode: "register" } as never} className="landing-cta">
                Join Now <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="landing-values" aria-label="How MingleConnect works">
            <LandingValue icon={<UsersRound />} title="Create Your Profile" detail="Show who you are" />
            <LandingValue icon={<Search />} title="Explore Matches" detail="Find your vibe" />
            <LandingValue icon={<MessageCircle />} title="Start Chatting" detail="It's easy and safe" />
            <LandingValue icon={<Heart />} title="Meet Real People" detail="Local and worldwide" />
          </div>
          <p className="landing-signature">Real Connections<br />Start Here <span>♡</span></p>
          <div className="landing-wave" aria-hidden="true" />
        </section>
      </main>
    </div>
  );
}

function LandingValue({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="landing-value">
      <span className="landing-value-icon">{icon}</span>
      <span><strong>{title}</strong><small>{detail}</small></span>
    </div>
  );
}
