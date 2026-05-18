import React from "react";

interface ScoreGaugeProps {
  score: number;
}

export const ScoreGauge = ({ score }: ScoreGaugeProps) => {
  const getScoreColor = (s: number) => {
    if (s >= 85) return "stroke-accent-green";
    if (s >= 70) return "stroke-accent-teal";
    if (s >= 50) return "stroke-accent-amber";
    return "stroke-accent-red";
  };

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="w-12 h-12 transform -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="currentColor"
          strokeWidth="3"
          fill="transparent"
          className="text-bg-border"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          fill="transparent"
          className={`transition-all duration-1000 ease-in-out ${getScoreColor(score)}`}
        />
      </svg>
      <span className={`absolute text-[11px] font-bold font-mono`}>{score}</span>
    </div>
  );
};
