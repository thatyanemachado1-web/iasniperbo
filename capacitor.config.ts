import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sniperbo.app",
  appName: "Sniper BO",
  webDir: "mobile-shell",
  server: {
    url: "https://sniperbo.com",
    cleartext: false,
    allowNavigation: ["sniperbo.com", "www.sniperbo.com"],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
