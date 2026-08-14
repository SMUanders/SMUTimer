/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { writeFileSync } from "node:fs";

// Simpel versionskontrol (INGEN service worker / offline-cache):
// Bygningens tidsstempel indlejres i appen som __APP_VERSION__ OG skrives til
// public/version.json. Appen henter version.json med jævne mellemrum og beder
// om genindlæsning, hvis serverens version afviger fra den kørende. Værdien
// beregnes én gang pr. vite-proces, så bundle og version.json altid matcher.
const APP_VERSION = new Date().toISOString();
writeFileSync("public/version.json", JSON.stringify({ version: APP_VERSION }) + "\n");

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: "node",
  },
});
