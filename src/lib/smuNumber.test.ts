import { describe, it, expect } from "vitest";
import { normalizeReference, referenceKind, smuNumberPart } from "./smuNumber";

describe("normalizeReference — SMU-nummer", () => {
  it("'184' → 'SMU-0184'", () => {
    expect(normalizeReference("184")).toBe("SMU-0184");
  });
  it("'0184' → 'SMU-0184'", () => {
    expect(normalizeReference("0184")).toBe("SMU-0184");
  });
  it("'SMU-184' → 'SMU-0184'", () => {
    expect(normalizeReference("SMU-184")).toBe("SMU-0184");
  });
  it("'SMU0184' → 'SMU-0184'", () => {
    expect(normalizeReference("SMU0184")).toBe("SMU-0184");
  });
  it("bevarer lange numre uden at klippe", () => {
    expect(normalizeReference("SMU-12345")).toBe("SMU-12345");
  });
  it("håndterer mellemrum", () => {
    expect(normalizeReference("  smu 184 ")).toBe("SMU-0184");
  });
});

describe("normalizeReference — intern kode", () => {
  it("'INTERN-LAGER' forbliver 'INTERN-LAGER'", () => {
    expect(normalizeReference("INTERN-LAGER")).toBe("INTERN-LAGER");
  });
  it("uppercaser intern kode", () => {
    expect(normalizeReference("intern-admin")).toBe("INTERN-ADMIN");
  });
});

describe("normalizeReference — valgfrit", () => {
  it("tomt felt forbliver tilladt (tomt)", () => {
    expect(normalizeReference("")).toBe("");
  });
  it("kun mellemrum → tomt", () => {
    expect(normalizeReference("   ")).toBe("");
  });
  it("fri kode bevares", () => {
    expect(normalizeReference("Projekt X")).toBe("Projekt X");
  });
});

describe("referenceKind", () => {
  it("intern kode → 'intern'", () => {
    expect(referenceKind("INTERN-LAGER")).toBe("intern");
  });
  it("SMU-nummer → 'smu'", () => {
    expect(referenceKind("SMU-0184")).toBe("smu");
  });
  it("tomt → 'smu' (default)", () => {
    expect(referenceKind("")).toBe("smu");
  });
});

describe("smuNumberPart", () => {
  it("fjerner SMU-prefiks til visning", () => {
    expect(smuNumberPart("SMU-0184")).toBe("0184");
  });
  it("uden prefiks bevares", () => {
    expect(smuNumberPart("184")).toBe("184");
  });
  it("tomt → tomt", () => {
    expect(smuNumberPart("")).toBe("");
  });
});
