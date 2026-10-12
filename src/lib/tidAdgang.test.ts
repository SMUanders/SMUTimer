import { describe, it, expect } from "vitest";
import { afgoerTidAdgang, type TidAdgangSvar } from "./tidAdgang";

const svar = (s: Partial<TidAdgangSvar>): TidAdgangSvar => ({ harAdgang: false, fejl: null, ...s });
const base = { supabaseConfigured: true, authLoading: false, harSession: true };

describe("afgoerTidAdgang — app-adgangs-gate for SMU Tid", () => {
  it("bruger med tid-adgang slipper ind", () => {
    expect(afgoerTidAdgang({ ...base, svar: svar({ harAdgang: true }) })).toBe("adgang");
  });

  it("indlogget bruger uden tid-adgang afvises", () => {
    expect(afgoerTidAdgang({ ...base, svar: svar({ harAdgang: false }) })).toBe("ingen_adgang");
  });

  it("fejl ved adgangstjek er fail-closed (ikke adgang)", () => {
    expect(afgoerTidAdgang({ ...base, svar: svar({ harAdgang: false, fejl: "netværk" }) })).toBe("fejl");
  });

  it("intet svar endnu = indlæser, ikke adgang", () => {
    expect(afgoerTidAdgang({ ...base, svar: null })).toBe("indlaeser");
    expect(afgoerTidAdgang({ ...base, authLoading: true, svar: null })).toBe("indlaeser");
  });

  it("uden session vises login-siden som før", () => {
    expect(afgoerTidAdgang({ ...base, harSession: false, svar: null })).toBe("login");
  });

  it("lokal dev uden Supabase forbliver åben (local fallback)", () => {
    expect(afgoerTidAdgang({ supabaseConfigured: false, authLoading: false, harSession: false, svar: null })).toBe("aaben");
  });
});
