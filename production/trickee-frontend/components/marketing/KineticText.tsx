import type { CSSProperties, ReactNode } from "react";
import { tokenizeKineticText } from "@/lib/kinetic-type.mjs";

type KineticTextProps = {
  as?: "h1" | "h2" | "h3" | "p" | "span";
  text: string;
  id?: string;
  className?: string;
  accent?: string;
  accentWords?: string[];
  childrenAfter?: ReactNode;
};

type KineticStyle = CSSProperties & {
  "--word-index": number;
  "--char-index": number;
};

export function KineticText({
  as: Component = "span",
  text,
  id,
  className,
  accent,
  accentWords = [],
  childrenAfter,
}: KineticTextProps) {
  const tokens = tokenizeKineticText(text);

  return (
    <Component id={id} className={className} aria-label={tokens.label} data-kinetic-heading
      style={{ "--kinetic-fit": `calc((100cqw - 32px) / ${Math.max(...tokens.words.map(word => word.chars.length * 0.72), 1)})` } as CSSProperties}>
      <span aria-hidden="true" className="kinetic-copy">
        {tokens.words.map((word) => (
          <span
            className={accentWords.includes(word.text) ? "kinetic-word kinetic-word--accent" : "kinetic-word"}
            data-kinetic-word
            key={`${word.text}-${word.wordIndex}`}
            style={{ "--word-index": word.wordIndex } as CSSProperties}
          >
            {word.chars.map((char) => (
              <span
                className={accent === char.text ? "kinetic-char kinetic-char--accent" : "kinetic-char"}
                data-kinetic-char
                key={`${char.charIndex}-${char.text}`}
                style={{ "--word-index": word.wordIndex, "--char-index": char.charIndex } as KineticStyle}
              >
                {char.text}
              </span>
            ))}
          </span>
        ))}
        {childrenAfter}
      </span>
    </Component>
  );
}
