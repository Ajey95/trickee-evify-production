import type { CSSProperties } from "react";

type StreakStyle = CSSProperties & {
  "--streak-index": number;
  "--streak-x": string;
  "--streak-y": string;
  "--streak-length": string;
  "--streak-delay": string;
};

export function JourneyAtmosphere() {
  return (
    <div className="journey-atmosphere" aria-hidden="true">
      <div className="journey-speed-field">
        {Array.from({ length: 28 }, (_, index) => {
          const style: StreakStyle = {
            "--streak-index": index,
            "--streak-x": `${(index * 37) % 103}%`,
            "--streak-y": `${(index * 61) % 101}%`,
            "--streak-length": `${70 + (index % 7) * 32}px`,
            "--streak-delay": `${-(index % 9) * 0.17}s`,
          };
          return <i key={index} style={style} />;
        })}
      </div>
      <div className="journey-aperture"><i /><i /><i /><i /></div>
      <div className="journey-route-flare"><i /></div>
      <div className="journey-velocity-type">
        <span>GPS FIRST</span>
        <span>PROTECTED RANGE</span>
        <span>ROAD INTELLIGENCE</span>
      </div>
      <div className="journey-scan-surface" />
      <div className="journey-vignette" />
    </div>
  );
}
