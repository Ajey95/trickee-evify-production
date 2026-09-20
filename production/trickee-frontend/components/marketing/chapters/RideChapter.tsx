import { BatteryCharging, Check, MapPin, Zap } from "lucide-react";
import { ChapterWord } from "../ChapterWord";
import { KineticText } from "../KineticText";

const states = [
  ["Protected range", "142 KM", "11 km of usable margin protected", BatteryCharging],
  ["Charging stop", "24 MIN", "Navi Mumbai · stall 04 ready", Zap],
  ["Arrival confidence", "18:42", "92% confidence · on time", Check],
] as const;

export function RideChapter() {
  return (
    <section id="ride" data-chapter="4" className="journey-track journey-ride" aria-labelledby="ride-title">
      <div className="journey-sticky journey-ride-stage">
        <ChapterWord>RIDE</ChapterWord>
        <div className="journey-city-grid" aria-hidden="true"><i /></div>
        <div className="journey-section-copy journey-ride-copy" data-reveal>
          <span className="journey-section-number">05</span>
          <KineticText as="h2" id="ride-title" text="Every turn, already understood." accentWords={["already", "understood."]} />
          <p>Protected range, the right charging stop, and arrival confidence — carried with the driver.</p>
        </div>
        <div className="journey-phone-wrap" data-phone-tilt>
          <div className="journey-phone">
            <div className="journey-phone-island" />
            <div className="journey-phone-map">
              <svg viewBox="0 0 390 780" preserveAspectRatio="none" aria-hidden="true">
                <path className="phone-road" d="M35 720C154 622 42 521 185 455S108 276 238 204s93-92 123-154" />
                <path className="phone-route" data-phone-route d="M35 720C154 622 42 521 185 455S108 276 238 204s93-92 123-154" />
              </svg>
              <span className="phone-location"><MapPin /></span>
            </div>
            <div className="journey-phone-states">
              {states.map(([label, value, note, Icon], index) => (
                <div key={label} data-ride-state={index} className={index === 0 ? "is-active" : ""}>
                  <Icon /><span>{label}</span><strong>{value}</strong><p>{note}</p>
                </div>
              ))}
            </div>
            <div className="journey-phone-bottom"><i /><span>Trickee GPS Driver</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
