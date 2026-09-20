import { BatteryCharging, CloudRain, Navigation, ShieldCheck } from "lucide-react";
import { ChapterWord } from "../ChapterWord";
import { KineticText } from "../KineticText";

const metrics = [
  ["Protected range", "142", "km", BatteryCharging],
  ["Battery state", "84", "%", ShieldCheck],
  ["Arrival", "18:42", "", Navigation],
  ["Route confidence", "92", "%", CloudRain],
] as const;

export function PrieChapter() {
  return (
    <section id="prie" data-chapter="3" className="journey-track journey-prie" aria-labelledby="prie-title">
      <div className="journey-sticky journey-prie-stage">
        <ChapterWord tone="yellow">DECIDE</ChapterWord>
        <div className="journey-section-copy journey-prie-copy" data-reveal>
          <span className="journey-section-number">04</span>
          <KineticText as="h2" id="prie-title" text="Foresight, made operational." accentWords={["made", "operational."]} />
          <p>PRIE turns the next kilometre into one calm decision surface for every operator.</p>
        </div>
        <div className="prie-console" data-prie-console>
          <div className="prie-topline"><span>PRIE / Live decision surface</span><i>Signal locked</i></div>
          <div className="prie-map">
            <svg viewBox="0 0 800 420" preserveAspectRatio="none" aria-hidden="true">
              <path d="M-20 330C130 250 220 360 352 260S566 184 820 62" />
              <path className="prie-route" d="M-20 330C130 250 220 360 352 260S566 184 820 62" />
              <circle cx="352" cy="260" r="8" /><circle className="prie-pulse" cx="352" cy="260" r="28" />
            </svg>
            <span className="prie-map-label">EV-104 / en route</span>
          </div>
          <div className="prie-metrics">
            {metrics.map(([label, value, suffix, Icon]) => (
              <article key={label}><Icon /><span>{label}</span><strong data-counter={value}>{value}<small>{suffix}</small></strong></article>
            ))}
          </div>
          <div className="prie-decision"><span>Recommended</span><strong>Keep route · charge at Navi Mumbai</strong><i>+11 km protected</i></div>
        </div>
      </div>
    </section>
  );
}
