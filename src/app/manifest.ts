import type { MetadataRoute } from "next";

// "Add to Home Screen" support (no offline caching: the app is online-only).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aqua Best",
    short_name: "Aqua Best",
    description: "POS and live monitoring for Aqua Best",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1f6fb2",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
