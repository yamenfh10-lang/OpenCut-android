import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.opencut.mobile",
  appName: "OpenCut",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
