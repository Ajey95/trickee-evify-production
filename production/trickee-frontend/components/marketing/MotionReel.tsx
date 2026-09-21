import Image from "next/image";
import { MOTION_REEL_TARGETS } from "@/lib/journey-navigation.mjs";
import { KineticText } from "./KineticText";

const frames = [
  { src: "/visuals/trickee-hero-fleet.png", alt: "Trickee route intelligence visualised around a moving vehicle", code: "LIVE / 01", label: "Read the road", href: MOTION_REEL_TARGETS["Read the road"] },
  { src: "/visuals/trickee-depot.png", alt: "Electric fleet at a depot", code: "FLEET / 02", label: "Move as one", href: MOTION_REEL_TARGETS["Move as one"] },
  { src: "/visuals/trickee-technician.png", alt: "Technician using Trickee field intelligence", code: "FIELD / 03", label: "See every signal", href: MOTION_REEL_TARGETS["See every signal"] },
  { src: "/visuals/trickee-living-route-concept-v3.png", alt: "A living route interface responding to road conditions", code: "ROUTE / 04", label: "Predict the next mile", href: MOTION_REEL_TARGETS["Predict the next mile"] },
  { src: "/visuals/trickee-mobile-ride-concept-v2.png", alt: "Trickee mobile ride guidance", code: "DRIVE / 05", label: "Arrive with confidence", href: MOTION_REEL_TARGETS["Arrive with confidence"] },
] as const;

type ReelGroupProps = {
  duplicate?: boolean;
  onNavigate: (href: string) => boolean;
};

function ReelGroup({ duplicate = false, onNavigate }: ReelGroupProps) {
  return (
    <div className="journey-reel-group" aria-hidden={duplicate || undefined}>
      {frames.map((frame, index) => {
        const item = <figure className="journey-reel-item" data-reel-frame>
          <Image
            src={frame.src}
            alt={duplicate ? "" : frame.alt}
            fill
            sizes="(max-width: 767px) 78vw, 42vw"
            className="journey-reel-image"
          />
          <span className="journey-reel-index">{String(index + 1).padStart(2, "0")}</span>
          <figcaption><small>{frame.code}</small><strong>{frame.label}</strong></figcaption>
        </figure>;

        return duplicate ? (
          <div className="journey-reel-link" key={`copy-${frame.code}`}>{item}</div>
        ) : (
          <a className="journey-reel-link" href={frame.href} key={`source-${frame.code}`} onClick={(event) => { if (onNavigate(frame.href)) event.preventDefault(); }} aria-label={`${frame.label}: jump to section`}>
            {item}
          </a>
        );
      })}
    </div>
  );
}

type MotionReelProps = {
  onNavigate: (href: string) => boolean;
};

export function MotionReel({ onNavigate }: MotionReelProps) {
  return (
    <section id="field-notes" className="journey-reel" aria-labelledby="field-notes-title">
      <div className="journey-reel-heading" data-reveal>
        <span className="journey-section-number">FIELD NOTES / 07</span>
        <KineticText as="h2" id="field-notes-title" text="Intelligence, in motion." accentWords={["motion."]} />
        <p>A continuous view of the vehicle, the route, and the decisions connecting them.</p>
      </div>
      <div className="journey-reel-orbit" aria-hidden="true"><i /><b>360</b></div>
      <div className="journey-reel-viewport">
        <div className="journey-reel-track" data-marquee-track>
          <ReelGroup onNavigate={onNavigate} />
          <ReelGroup duplicate onNavigate={onNavigate} />
        </div>
      </div>
      <p className="journey-reel-note">Continuous field loop / live intelligence</p>
    </section>
  );
}
