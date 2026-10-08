import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Heart, LockKeyhole, MessageCircleHeart, ShieldCheck } from "lucide-react";
import heroImg from "@/assets/landing-couple.png";

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
          <span className="landing-brand-mark"><Heart className="size-4" fill="currentColor" /></span>
          <span>Mingle<span className="landing-brand-accent">Connect</span></span>
        </Link>
        <nav className="landing-nav-links" aria-label="Main navigation">
          <a href="#why-mingle">Why MingleConnect</a>
          <a href="#our-promise">Our promise</a>
        </nav>
        <Link to="/auth" search={{ mode: "login" } as never} className="landing-sign-in">
          Sign in <ArrowUpRight aria-hidden="true" />
        </Link>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-copy">
            <p className="landing-eyebrow"><span /> DATING WITH INTENTION</p>
            <h1 id="landing-title">A real connection<br />starts with <em>you.</em></h1>
            <p className="landing-subtitle">
              Meet genuine people who are ready for something meaningful. Your next great conversation could be closer than you think.
            </p>
            <div className="landing-actions">
              <Link to="/auth" search={{ mode: "register" } as never} className="landing-cta">
                Join MingleConnect <ArrowUpRight aria-hidden="true" />
              </Link>
              <span className="landing-join-note">Free to join · Made for meaningful connections</span>
            </div>
          </div>

          <div className="landing-visual">
            <div className="landing-photo-frame">
              <img src={heroImg} alt="A couple sharing a warm moment together" className="landing-hero-image" />
            </div>
            <span className="landing-photo-heart" aria-hidden="true"><Heart fill="currentColor" /></span>
          </div>
        </section>

        <section className="landing-values" id="why-mingle" aria-label="What makes MingleConnect special">
          <LandingValue icon={<ShieldCheck />} title="People first" detail="Genuine profiles" />
          <LandingValue icon={<MessageCircleHeart />} title="Talk naturally" detail="Meaningful conversations" />
          <LandingValue icon={<Heart />} title="Date with purpose" detail="Connections that matter" />
          <LandingValue icon={<LockKeyhole />} title="Your choice" detail="Share contacts on your terms" />
        </section>

        <section className="landing-invitation" id="our-promise">
          <div><p className="landing-invitation-kicker">YOUR STORY, YOUR PACE</p><h2>Good things start with hello.</h2></div>
          <Link to="/auth" search={{ mode: "register" } as never} className="landing-bottom-cta">Find your connection <ArrowUpRight aria-hidden="true" /></Link>
        </section>
      </main>
      <footer className="landing-footer"><span>© {new Date().getFullYear()} MingleConnect</span><span>Made for real connections <Heart className="size-3" fill="currentColor" aria-hidden="true" /></span></footer>
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
