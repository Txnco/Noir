import Link from "next/link";
import type { CSSProperties } from "react";

type Variant = "wordmark" | "monogram";
type Tone = "dark" | "light";

interface LogoProps {
  variant?: Variant;
  /** Tone of the logo itself — "dark" on light backgrounds, "light" on dark backgrounds. */
  tone?: Tone;
  /** Rendered height in px. Width auto-scales from the SVG's intrinsic ratio. */
  height?: number;
  className?: string;
  /** Wrap in a Next Link with this href. */
  href?: string;
  /** Accessible label. Defaults to "Noir". Pass empty string to mark decorative. */
  alt?: string;
  style?: CSSProperties;
}

const ASSETS: Record<Variant, Record<Tone, { src: string; ratio: number }>> = {
  wordmark: {
    // viewBox 1000 x 600 → width = height * (1000 / 600)
    dark: { src: "/assets/logo/WordMarkWhite_no_bg.svg", ratio: 1000 / 600 },
    light: { src: "/assets/logo/WordMarkBlack_no_bg.svg", ratio: 1000 / 600 },
  },
  monogram: {
    // viewBox 1000 x 1000 → square. Only the white _no_bg monogram is provided,
    // so both tones map to it. Use tone="light" on dark surfaces.
    dark: { src: "/assets/logo/MonogramWhite_no_bg.svg", ratio: 1 },
    light: { src: "/assets/logo/MonogramWhite_no_bg.svg", ratio: 1 },
  },
};

export default function Logo({
  variant = "wordmark",
  tone = "dark",
  height = 28,
  className,
  href,
  alt = "Noir",
  style,
}: LogoProps) {
  const { src, ratio } = ASSETS[variant][tone];
  const width = Math.round(height * ratio);

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      draggable={false}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center select-none"
        aria-label={alt || "Noir"}
      >
        {img}
      </Link>
    );
  }

  return img;
}
