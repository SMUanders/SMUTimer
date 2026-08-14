// Den kørende apps version (bygnings-tidsstempel). Indlejret ved build.
// Fallback "dev" hvis konstanten ikke er defineret (fx et rent test-miljø).
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

/** Kort, læsbar version til diskret visning: "YYYY-MM-DD HH:MM". */
export function appVersionShort(): string {
  const d = new Date(APP_VERSION);
  if (Number.isNaN(d.getTime())) return APP_VERSION;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
