import { Atom } from "loading-dev";
import { cn } from "@/lib/utils";

type AtomLoaderProps = {
  label: string;
  className?: string;
  color?: string;
  size?: number;
};

export function AtomLoader({
  label,
  className,
  color = "var(--color-primary)",
  size = 32,
}: AtomLoaderProps) {
  return (
    <div className={cn("atom-loader", className)} role="status" aria-live="polite">
      <Atom color={color} duration={920} size={size} />
      <span>{label}</span>
    </div>
  );
}
