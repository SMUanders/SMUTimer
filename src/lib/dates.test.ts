import { describe, it, expect } from "vitest";
import { datoFraSoegning } from "./dates";

// Pakke 1 (Manus QA): valgt dato bevares i adressen ved genindlæsning.
describe("datoFraSoegning", () => {
  it("læser en gyldig ?dato=", () => {
    expect(datoFraSoegning("?dato=2026-10-21")).toBe("2026-10-21");
    expect(datoFraSoegning("?medarbejder=abc&dato=2026-10-23")).toBe("2026-10-23");
  });
  it("ugyldig eller manglende dato → null", () => {
    expect(datoFraSoegning("")).toBeNull();
    expect(datoFraSoegning("?dato=21-10-2026")).toBeNull();
    expect(datoFraSoegning("?dato=2026-02-31")).toBeNull();
    expect(datoFraSoegning("?dato=<script>")).toBeNull();
  });
});
