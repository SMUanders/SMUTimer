/// <reference types="vite/client" />

// Indlejres ved build i vite.config.ts (define). Bygningens tidsstempel (ISO).
declare const __APP_VERSION__: string;
// Menneskelig produktversion fra package.json (fx "2.1.0"). Vises diskret i UI.
declare const __APP_PRODUCT_VERSION__: string;
