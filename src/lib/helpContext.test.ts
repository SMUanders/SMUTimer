import { describe, it, expect, beforeEach } from "vitest";
import { getHelp, setHelp, clearHelp, helpNote, isHelpNote, HELP_NOTE } from "./helpContext";

// Minimal localStorage-stub (vitest kører i node-miljø).
beforeEach(() => {
  const map = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

const own = { categoryId: "montage-ude", subcategoryId: null, orderNumber: "54277", note: "min opgave" };

describe("helpContext (husk egen opgave under hjælp)", () => {
  it("ingen hjælp-session som udgangspunkt", () => {
    expect(getHelp("anders")).toBeNull();
  });

  it("set/get husker den egne opgave pr. medarbejder", () => {
    setHelp("anders", own);
    expect(getHelp("anders")).toEqual(own);
    expect(getHelp("natasha")).toBeNull(); // isoleret pr. medarbejder
  });

  it("clear rydder hjælp-sessionen", () => {
    setHelp("anders", own);
    clearHelp("anders");
    expect(getHelp("anders")).toBeNull();
  });
});

describe("helpNote / isHelpNote (markering i Min dag)", () => {
  it("helpNote uden egen note = ren markør", () => {
    expect(helpNote("")).toBe(HELP_NOTE);
  });
  it("helpNote med egen note bevarer den efter markør", () => {
    expect(helpNote("skiftede klinge")).toBe(`${HELP_NOTE} — skiftede klinge`);
  });
  it("isHelpNote genkender hjælp-linjer", () => {
    expect(isHelpNote(helpNote("x"))).toBe(true);
    expect(isHelpNote(HELP_NOTE)).toBe(true);
    expect(isHelpNote("almindelig note")).toBe(false);
    expect(isHelpNote(null)).toBe(false);
  });
});
