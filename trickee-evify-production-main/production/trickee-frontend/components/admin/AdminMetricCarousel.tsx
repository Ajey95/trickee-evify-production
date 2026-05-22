"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface AdminMetric {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  accentClass: string;
}

interface AdminMetricCarouselProps {
  metrics: AdminMetric[];
}

export function AdminMetricCarousel({ metrics }: AdminMetricCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(metrics.length - 1, 0)));
  }, [metrics.length]);

  useEffect(() => {
    const activeCard = trackRef.current?.querySelector<HTMLElement>(`[data-admin-metric-index="${activeIndex}"]`);
    activeCard?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeIndex]);

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => {
      const next = current + direction;
      if (next < 0) return metrics.length - 1;
      if (next >= metrics.length) return 0;
      return next;
    });
  };

  return (
    <section className="watermark-section rounded-2xl border border-bg-border/80 bg-bg-card/35 p-5 shadow-2xl shadow-black/30">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-accent-teal">Admin Signal Carousel</p>
          <h2 className="mt-1 text-xl font-bold text-text-primary">Model And Platform Health</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => move(-1)}
            className="grid h-10 w-10 place-items-center rounded-full border border-bg-border bg-bg-primary/80 text-text-primary transition hover:border-accent-teal hover:text-accent-teal"
            aria-label="Previous admin signal"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="grid h-10 w-10 place-items-center rounded-full border border-bg-border bg-bg-primary/80 text-text-primary transition hover:border-accent-teal hover:text-accent-teal"
            aria-label="Next admin signal"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={trackRef} className="vehicle-carousel-track">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          const distance = Math.abs(index - activeIndex);
          return (
            <div
              key={metric.label}
              data-admin-metric-index={index}
              className="vehicle-carousel-item"
              data-active={index === activeIndex}
              data-distance={distance > 1 ? "far" : distance === 1 ? "near" : "active"}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
            >
              <Card className="h-full min-h-[190px]">
                <div className="flex items-start justify-between">
                  <p className="kpi-label">{metric.label}</p>
                  <Icon className={`h-5 w-5 ${metric.accentClass}`} />
                </div>
                <p className={`mt-7 font-mono text-4xl font-black tracking-tight ${metric.accentClass}`}>{metric.value}</p>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-text-dim">{metric.helper}</p>
              </Card>
            </div>
          );
        })}
      </div>
    </section>
  );
}
