import { describe, it, expect } from "vitest";
import { canLeaderCorrect } from "./tidRole";

describe("canLeaderCorrect — hvem må vise/udføre leder-korrektion", () => {
  it("leder og admin må korrigere i produktion", () => {
    expect(canLeaderCorrect({ supabaseConfigured: true, role: "leder" })).toBe(true);
    expect(canLeaderCorrect({ supabaseConfigured: true, role: "admin" })).toBe(true);
  });

  it("medarbejder og observatør må IKKE korrigere andres dag (read-only)", () => {
    expect(canLeaderCorrect({ supabaseConfigured: true, role: "medarbejder" })).toBe(false);
    expect(canLeaderCorrect({ supabaseConfigured: true, role: "observatoer" })).toBe(false);
  });

  it("ukendt/ingen rolle i produktion = ingen korrektion", () => {
    expect(canLeaderCorrect({ supabaseConfigured: true, role: null })).toBe(false);
  });

  it("lokal dev (ingen Supabase/RLS): korrektion tilladt så flowet kan afprøves", () => {
    expect(canLeaderCorrect({ supabaseConfigured: false, role: null })).toBe(true);
  });
});
