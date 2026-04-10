import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/news-app/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Actu Express",
        short_name: "ActuExpress",
        description: "L'essentiel de l'info, sans le superflu",
        theme_color: "#1A1A2E",
        background_color: "#F8F8FC",
        display: "standalone",
        start_url: "/news-app/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\/news/,
            handler: "NetworkFirst",
            options: {
              cacheName: "news-api",
              expiration: { maxAgeSeconds: 600 },
            },
          },
        ],
      },
    }),
  ],
});
