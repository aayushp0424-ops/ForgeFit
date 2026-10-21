import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ForgeFit — Food & Fitness Tracker",
    short_name: "ForgeFit",
    description: "Track meals, macros, water, steps, and workouts.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0B151B",
    theme_color: "#0B151B",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ]
  };
}
