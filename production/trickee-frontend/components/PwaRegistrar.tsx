"use client";

import React from "react";

export function PwaRegistrar() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA installability should never block the dashboard.
    });
  }, []);

  return null;
}
