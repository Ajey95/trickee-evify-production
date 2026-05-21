"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Vehicle } from "@/types";
import { VehicleCard } from "@/components/fleet/VehicleCard";

interface VehicleCarouselProps {
  vehicles: Vehicle[];
}

export function VehicleCarousel({ vehicles }: VehicleCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!vehicles.length) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((current) => Math.min(current, vehicles.length - 1));
  }, [vehicles.length]);

  useEffect(() => {
    const track = trackRef.current;
    const activeCard = track?.querySelector<HTMLElement>(`[data-carousel-index="${activeIndex}"]`);
    activeCard?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeIndex]);

  if (!vehicles.length) {
    return null;
  }

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => {
      const next = current + direction;
      if (next < 0) return vehicles.length - 1;
      if (next >= vehicles.length) return 0;
      return next;
    });
  };

  return (
    <section className="fleet-vehicle-carousel watermark-section rounded-2xl bg-bg-card/20 p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-accent-teal">Live Fleet Carousel</p>
          <h2 className="mt-1 text-xl font-bold text-text-primary">Driver-Vehicle Intelligence</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => move(-1)}
            className="grid h-10 w-10 place-items-center rounded-full border border-bg-border bg-bg-primary/80 text-text-primary transition hover:border-accent-teal hover:text-accent-teal"
            aria-label="Previous vehicle"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="grid h-10 w-10 place-items-center rounded-full border border-bg-border bg-bg-primary/80 text-text-primary transition hover:border-accent-teal hover:text-accent-teal"
            aria-label="Next vehicle"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={trackRef} className="vehicle-carousel-track">
        {vehicles.map((vehicle, index) => {
          const distance = Math.abs(index - activeIndex);
          return (
            <div
              key={vehicle.id}
              data-carousel-index={index}
              className="vehicle-carousel-item"
              data-active={index === activeIndex}
              data-distance={distance > 1 ? "far" : distance === 1 ? "near" : "active"}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
            >
              <VehicleCard vehicle={vehicle} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
