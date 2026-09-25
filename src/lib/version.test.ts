import { describe, it, expect } from "vitest";
import { formatProductVersion } from "./version";

describe("formatProductVersion — diskret produktlabel fra package.json", () => {
  it("2.1.0 → v2.1", () => {
    expect(formatProductVersion("2.1.0")).toBe("v2.1");
  });
  it("2.1.3 → v2.1 (patch skjules i labelen)", () => {
    expect(formatProductVersion("2.1.3")).toBe("v2.1");
  });
  it("10.0.0 → v10.0", () => {
    expect(formatProductVersion("10.0.0")).toBe("v10.0");
  });
  it("ukendt streng returneres uændret", () => {
    expect(formatProductVersion("dev")).toBe("dev");
  });
});
