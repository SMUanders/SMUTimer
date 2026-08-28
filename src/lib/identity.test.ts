import { describe, it, expect } from "vitest";
import { resolveEmployeeIdentity } from "./identity";

describe("resolveEmployeeIdentity — owner-scope binding", () => {
  it("produktion: identitet = auth.uid, ingen vælger, legacy ryddes", () => {
    expect(
      resolveEmployeeIdentity({
        supabaseConfigured: true,
        authUserId: "uid-anders",
        legacyStored: null,
      })
    ).toEqual({ employeeId: "uid-anders", pickerAllowed: false, clearLegacy: true });
  });

  it("SIKKERHED: legacy localStorage kan ALDRIG overtrumfe auth-identitet i produktion", () => {
    // Gammel browser havde 'uid-natasha' valgt, men brugeren er logget ind som Anders.
    const r = resolveEmployeeIdentity({
      supabaseConfigured: true,
      authUserId: "uid-anders",
      legacyStored: "uid-natasha",
    });
    expect(r.employeeId).toBe("uid-anders"); // ikke natasha
    expect(r.pickerAllowed).toBe(false);
    expect(r.clearLegacy).toBe(true);
  });

  it("produktion uden auth.uid: ingen identitet, men stadig ingen vælger", () => {
    const r = resolveEmployeeIdentity({
      supabaseConfigured: true,
      authUserId: null,
      legacyStored: "uid-natasha",
    });
    expect(r.employeeId).toBeNull(); // falder aldrig tilbage på legacy
    expect(r.pickerAllowed).toBe(false);
  });

  it("lokal dev: vælger-fallback fra localStorage er tilladt", () => {
    expect(
      resolveEmployeeIdentity({
        supabaseConfigured: false,
        authUserId: null,
        legacyStored: "anders",
      })
    ).toEqual({ employeeId: "anders", pickerAllowed: true, clearLegacy: false });
  });

  it("lokal dev uden valg: ingen identitet, vælger vises", () => {
    const r = resolveEmployeeIdentity({
      supabaseConfigured: false,
      authUserId: null,
      legacyStored: null,
    });
    expect(r.employeeId).toBeNull();
    expect(r.pickerAllowed).toBe(true);
  });
});
