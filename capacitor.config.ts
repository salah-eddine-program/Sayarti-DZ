import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.APP_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "dz.sayarti.app",
  appName: "Sayarti DZ",
  webDir: "dist/public",
  bundledWebRuntime: false,
  ...(serverUrl ? { server: { url: serverUrl, cleartext: false } } : {}),
};

export default config;
