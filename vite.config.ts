import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative assets work both at / and at GitHub Pages' /capibora/.
  base: "./",
  plugins: [
    react(),
    {
      name: "capibora-startup-styles",
      transformIndexHtml: {
        order: "post",
        handler(html) {
          // The inline startup screen must paint while the full app stylesheet downloads.
          return html.replace(
            /<link rel="stylesheet"([^>]+)>/g,
            '<link rel="stylesheet"$1 data-capibora-style="loading" media="print" onload="this.media=\'all\';this.dataset.capiboraStyle=\'ready\'" onerror="this.dataset.capiboraStyle=\'failed\'">',
          );
        },
      },
    },
  ],
  test: {
    include: ["src/**/*.test.{ts,tsx}", "supabase/functions/_shared/taunt-delivery.test.ts"],
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
  },
});
