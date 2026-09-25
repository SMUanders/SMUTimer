/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { writeFileSync, readFileSync } from "node:fs";

// Simpel versionskontrol (INGEN service worker / offline-cache):
// Bygningens tidsstempel indlejres i appen som __APP_VERSION__ OG skrives til
// public/version.json. Appen henter version.json med jævne mellemrum og beder
// om genindlæsning, hvis serverens version afviger fra den kørende. Værdien
// beregnes én gang pr. vite-proces, så bundle og version.json altid matcher.
const APP_VERSION = new Date().toISOString();
writeFileSync("public/version.json", JSON.stringify({ version: APP_VERSION }) + "\n");

// Menneskelig PRODUKTVERSION — single source of truth = package.json "version".
// Indlejres som __APP_PRODUCT_VERSION__ og vises diskret i UI ("SMU Tid v2.1").
// Adskilt fra build-tidsstemplet (__APP_VERSION__), som er teknisk build-id.
const PRODUCT_VERSION = JSON.parse(readFileSync("./package.json", "utf-8")).version as string;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_PRODUCT_VERSION__: JSON.stringify(PRODUCT_VERSION),
  },
  server: {
    // Brug den tildelte PORT (autoPort) hvis sat; ellers 5173 som standard.
    port: Number(process.env.PORT) || 5173,
  },
  test: {
    globals: true,
    environment: "node",
  },
});
