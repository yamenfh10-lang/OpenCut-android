import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone Capacitor SPA. No SSR plugins here on purpose:
// apps/web is TanStack Start + Cloudflare SSR and cannot run in a WebView.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
  preview: {
    port: 4174,
  },
});
