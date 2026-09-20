import { ChapterWord } from "../ChapterWord";
import { KineticText } from "../KineticText";

const layers = [
  ["Elevation", "Gradient changes usable energy before the climb begins."],
  ["Weather", "Heat, rain, and wind become range—not surprises."],
  ["Traffic", "Every slow-down reshapes arrival and charge confidence."],
  ["Charging", "The right stop enters the route before margin becomes risk."],
];

export function PredictChapter() {
  return (
    <section id="predict" data-chapter="2" className="journey-track journey-predict" aria-labelledby="predict-title">
      <div className="journey-sticky journey-predict-stage">
        <ChapterWord>PREDICT</ChapterWord>
        <div className="journey-section-copy journey-predict-copy" data-reveal>
          <span className="journey-section-number">03</span>
          <KineticText as="h2" id="predict-title" text="The road speaks in signals." accentWords={["in", "signals."]} />
          <p>Trickee assembles the conditions around every vehicle into one continuously protected route.</p>
        </div>
        <div className="journey-route-instrument" aria-label="Route intelligence layers">
          <div className="journey-route-dial" aria-hidden="true"><i /><i /><i /></div>
          <svg viewBox="0 0 620 620" aria-hidden="true">
            <path className="journey-map-line" d="M92 538C116 438 246 476 216 365s119-100 102-194S438 88 523 52" />
            <path className="journey-map-energy" data-predict-route d="M92 538C116 438 246 476 216 365s119-100 102-194S438 88 523 52" />
            {["92,538", "216,365", "318,171", "523,52"].map((point) => { const [cx, cy] = point.split(","); return <circle key={point} cx={cx} cy={cy} r="7" />; })}
          </svg>
          <div className="journey-predict-value"><strong data-layer-value>7.4%</strong><span data-layer-meta>grade ahead</span></div>
        </div>
        <ol className="journey-layer-list">
          {layers.map(([label, description], index) => (
            <li key={label} data-layer={index} className={index === 0 ? "is-active" : ""}>
              <span>0{index + 1}</span><div><b>{label}</b><p>{description}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
