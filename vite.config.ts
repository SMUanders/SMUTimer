/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { platformUpdate } from "./src/platform-update/vitePlatformUpdate";

// Update-notifikation (INGEN service worker / offline-cache): build-id'et (__APP_VERSION__) og
// dist/version.json kommer fra det fælles platform-update-modul (src/platform-update/).

// Menneskelig PRODUKTVERSION — single source of truth = package.json "version".
// Indlejres som __APP_PRODUCT_VERSION__ og vises diskret i UI ("SMU Tid v2.1").
// Adskilt fra build-tidsstemplet (__APP_VERSION__), som er teknisk build-id.
const PRODUCT_VERSION = JSON.parse(readFileSync("./package.json", "utf-8")).version as string;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), platformUpdate()],
  // Fast port pr. app (porttabel i SMU_APP_STANDARD.md). strictPort: optaget port = fejl, ikke en anden port.
  server: { port: 5182, strictPort: true },
  define: {
    __APP_PRODUCT_VERSION__: JSON.stringify(PRODUCT_VERSION),
  },
  test: {
    globals: true,
    environment: "node",
  },
});
