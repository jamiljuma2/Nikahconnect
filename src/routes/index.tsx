import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Sparkles, Shield, MessageCircleHeart } from "lucide-react";
import heroImg from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-screen bg-background">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link to="/" className="font-display text-2xl font-semibold">
          Mingle<span className="text-primary">Connect</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/auth" search={{ mode: "login" } as never}>
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link to="/auth" search={{ mode: "register" } as never}>
            <Button className="gradient-romance shadow-romance text-primary-foreground">
              Join free
            </Button>
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-12 md:grid-cols-2 md:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <Sparkles className="size-3.5" /> Built for real connection
            </span>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.05] sm:text-6xl md:text-7xl">
              Find someone who feels like <span className="text-primary">home</span>.
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              Swipe with intention. Chat without games. Reveal contacts only when the spark is mutual —
              powered by secure M-Pesa unlocks.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" search={{ mode: "register" } as never}>
                <Button size="lg" className="gradient-romance shadow-romance text-primary-foreground">
                  Create your profile
                </Button>
              </Link>
              <Link to="/auth" search={{ mode: "login" } as never}>
                <Button size="lg" variant="outline">
                  I have an account
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] gradient-romance opacity-30 blur-3xl" />
            <img
              src={heroImg}
              alt="A couple silhouetted against a warm sunset"
              width={1600}
              height={1200}
              className="aspect-[4/5] w-full rounded-[2rem] object-cover shadow-romance"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          <Feature
            icon={<Heart className="size-5" />}
            title="Mutual matches only"
            body="You both have to like each other before you can chat. No cold DMs, no spam."
          />
          <Feature
            icon={<MessageCircleHeart className="size-5" />}
            title="No-digit chat zone"
            body="Numbers are blocked in messages so contacts stay private until you both agree."
          />
          <Feature
            icon={<Shield className="size-5" />}
            title="Pay only to reveal"
            body="Unlock a real phone number via M-Pesa, only after a match feels right."
          />
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} MingleConnect</span>
          <span>Made with love in Nairobi.</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-border gradient-card p-6 shadow-card">
      <div className="inline-flex size-10 items-center justify-center rounded-full bg-accent text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-2xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
