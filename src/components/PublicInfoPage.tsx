import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export function PublicInfoPage({
  eyebrow = "NikahConnect",
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="public-info-page">
      <header className="public-info-nav">
        <Link to="/" aria-label="NikahConnect home">
          <BrandLogo className="public-info-logo" />
        </Link>
        <Link className="public-info-home-link" to="/">
          <ArrowLeft size={16} /> Home
        </Link>
      </header>
      <article className="public-info-content">
        <p className="public-info-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="public-info-intro">{intro}</p>
        {children}
      </article>
      <footer className="public-info-footer">
        <BrandLogo className="public-info-footer-logo" />
        <nav aria-label="Legal and support links">
          <Link to="/about">About</Link>
          <Link to="/membership">Membership</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/community-guidelines">Community Guidelines</Link>
        </nav>
      </footer>
    </main>
  );
}
