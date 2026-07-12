import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Expense Dashboard",
    short_name: "Finance",
    description: "A private personal finance dashboard.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5eff3",
    theme_color: "#241457",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
