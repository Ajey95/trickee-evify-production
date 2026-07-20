"use client";

import React from "react";
import { LocateFixed, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

type BrowserLocation = {
  lat: number;
  lng: number;
  accuracy_m?: number;
  captured_at: string;
};

type DriverMobileReadinessProps = {
  onLocation?: (location: BrowserLocation) => void;
};

export function DriverMobileReadiness({
  onLocation,
}: DriverMobileReadinessProps) {
  const [locationStatus, setLocationStatus] = React.useState<
    "idle" | "requesting" | "enabled" | "blocked"
  >("idle");
  const [message, setMessage] = React.useState("");
  const locationWatchIdRef = React.useRef<number | null>(null);

  const clearLocationWatch = React.useCallback(() => {
    if (locationWatchIdRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }
  }, []);

  const applyPosition = React.useCallback(
    (position: GeolocationPosition) => {
      const nextLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy_m: position.coords.accuracy,
        captured_at: new Date(position.timestamp).toISOString(),
      };
      onLocation?.(nextLocation);
      setLocationStatus("enabled");
      setMessage("");
    },
    [onLocation],
  );

  const enableLocation = React.useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("blocked");
      setMessage("Location is not available in this browser.");
      return;
    }

    setLocationStatus("requesting");
    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 15_000,
    };

    navigator.geolocation.getCurrentPosition(
      applyPosition,
      (error) => {
        setLocationStatus("blocked");
        setMessage(error.message || "Location permission was not allowed.");
      },
      options,
    );

    clearLocationWatch();
    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      applyPosition,
      (error) => {
        setLocationStatus("blocked");
        setMessage(error.message || "Location permission was not allowed.");
      },
      options,
    );
  }, [applyPosition, clearLocationWatch]);

  React.useEffect(() => clearLocationWatch, [clearLocationWatch]);

  React.useEffect(() => {
    enableLocation();
  }, [enableLocation]);

  return (
    <Card className="border-accent-teal/20 bg-accent-teal/[0.03]">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent-teal/25 bg-accent-teal/10">
            <Smartphone className="h-5 w-5 text-accent-teal" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Ride setup
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-dim">
              Share location while this browser stays open.
            </p>
            {message && (
              <p className="mt-2 text-xs text-accent-amber">{message}</p>
            )}
          </div>
        </div>

        <div>
          <Button
            type="button"
            variant={locationStatus === "enabled" ? "primary" : "outline"}
            size="sm"
            className="min-h-10 gap-2"
            onClick={enableLocation}
            isLoading={locationStatus === "requesting"}
          >
            <LocateFixed className="h-4 w-4" />
            {locationStatus === "enabled" ? "Location On" : "Use location"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
