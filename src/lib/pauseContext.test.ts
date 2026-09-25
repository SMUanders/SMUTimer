import { describe, it, expect, beforeEach, vi } from "vitest";
import { getPause, setPause, clearPause } from "./pauseContext";
import type { OwnTask } from "./helpContext";

// Minimal in-memory localStorage (vitest kører i node-miljø uden DOM).
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

const task: OwnTask = {
  categoryId: "montage-internt",
  subcategoryId: "montage-internt__montering",
  orderNumber: "SMU-0123",
  note: "5 Volvo trækkere",
};

describe("pauseContext — husk/genoptag opgave over en pause", () => {
  it("uden kontekst → null (standalone pause)", () => {
    expect(getPause("anders")).toBeNull();
  });

  it("set → get returnerer den huskede opgave (reference/kategori/note bevaret)", () => {
    setPause("anders", task);
    expect(getPause("anders")).toEqual(task);
  });

  it("clear fjerner konteksten (efter genoptag)", () => {
    setPause("anders", task);
    clearPause("anders");
    expect(getPause("anders")).toBeNull();
  });

  it("er isoleret pr. medarbejder", () => {
    setPause("anders", task);
    expect(getPause("natasha")).toBeNull();
  });
});
