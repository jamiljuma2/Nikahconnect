import logo from "@/assets/mingleconnect-logo.png";

export function BrandLogo({ className }: { className?: string }) {
  return <img src={logo} alt="" aria-hidden="true" draggable={false} className={className} />;
}
