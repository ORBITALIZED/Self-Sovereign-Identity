import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

export interface LogoProps {
  /** Render as a router Link (default) or a static `<div>`. */
  asLink?: boolean;
  /** Optional extra class names. */
  className?: string;
  /** Override the visible brand name. */
  text?: string;
}

/**
 * Brand mark used in the header and any auth/loading splash screens.
 * Renders the shield glyph plus the gradient brand name. When `asLink`
 * is true (default) the whole mark is a router link back to `/`.
 */
export default function Logo({
  asLink = true,
  className,
  text = "Self-Sovereign Identity",
}: LogoProps) {
  const inner = (
    <>
      <Shield className="w-6 h-6 text-brand-500" aria-hidden="true" />
      <span className="gradient-text">{text}</span>
    </>
  );
  if (!asLink) {
    return (
      <div
        className={"flex items-center gap-2 text-xl font-semibold " + (className ?? "")}
        aria-label={text}
      >
        {inner}
      </div>
    );
  }
  return (
    <Link
      to="/"
      className={"flex items-center gap-2 text-xl font-semibold " + (className ?? "")}
      aria-label={text}
    >
      {inner}
    </Link>
  );
}
