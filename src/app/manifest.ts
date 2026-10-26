import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Log",
    short_name: "Log",
    description: "Personal food and gym log",
    start_url: "/",
    display: "standalone",
    background_color: "#141412",
    theme_color: "#141412",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
