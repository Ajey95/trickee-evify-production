import Image from "next/image";
import { ChapterWord } from "../ChapterWord";
import { KineticText } from "../KineticText";

const proof = [
  ["92", "%", "route confidence"],
  ["+11", " km", "range protected"],
  ["20", " Hz", "live signal"],
] as const;

export function TrustChapter() {
  return (
    <section id="trust" data-chapter="5" className="journey-trust" aria-labelledby="trust-title">
      <ChapterWord tone="yellow">PROOF</ChapterWord>
      <div className="journey-proof-images" aria-hidden="true">
        <div><Image src="/visuals/trickee-depot.png" alt="" fill sizes="50vw" /></div>
        <div><Image src="/visuals/trickee-technician.png" alt="" fill sizes="50vw" /></div>
      </div>
      <div className="journey-section-copy journey-trust-copy" data-reveal>
        <span className="journey-section-number">06</span>
        <KineticText as="h2" id="trust-title" text="Proof, in every kilometre." accentWords={["kilometre."]} />
      </div>
      <div className="journey-proof-metrics">
        {proof.map(([value, suffix, label]) => <article key={label}><strong data-proof-value={value}>{value}<small>{suffix}</small></strong><span>{label}</span></article>)}
      </div>
    </section>
  );
}
