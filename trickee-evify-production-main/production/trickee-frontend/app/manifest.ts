import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trickee EV Intelligence",
    short_name: "Trickee",
    description: "EV fleet intelligence, live SOC, route risk, charging decisions, and driver operations.",
    start_url: "/fleet",
    scope: "/",
    display: "standalone",
    background_color: "#07090d",
    theme_color: "#07090d",
    orientation: "portrait-primary",
    categories: ["business", "navigation", "productivity"],
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/trickee.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
