import Image from "next/image";
import { ChapterWord } from "../ChapterWord";
import { KineticText } from "../KineticText";

export function SignalGapChapter() {
  return (
    <section id="signal-gap" data-chapter="1" className="journey-track journey-signal" aria-labelledby="signal-title">
      <div className="journey-sticky journey-signal-stage">
        <ChapterWord tone="coral">SIGNAL</ChapterWord>
        <div className="journey-signal-right">
          <Image src="/visuals/trickee-hero-fleet.png" alt="" fill sizes="100vw" className="journey-signal-image" />
          <div className="journey-clean-traces" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</div>
        </div>
        <div className="journey-signal-left" data-signal-left>
          <div className="journey-noise" aria-hidden="true" />
          <div className="journey-broken-traces" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
        </div>
        <div className="journey-signal-seam" data-signal-seam aria-hidden="true"><i /></div>
        <div className="journey-signal-labels" aria-hidden="true"><span>BMS estimate</span><span>GPS-first</span></div>
        <div className="journey-section-copy" data-reveal>
          <span className="journey-section-number">02</span>
          <KineticText as="h2" id="signal-title" text="The signal gap." accentWords={["gap."]} />
          <p>BMS assumptions drift. GPS-first intelligence stays grounded in the road actually travelled.</p>
        </div>
      </div>
    </section>
  );
}
