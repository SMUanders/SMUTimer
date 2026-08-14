import { describe, it, expect } from "vitest";
import { floorTo15, ceilTo15 } from "./time";

describe("floorTo15 (start rundes ned)", () => {
  it("09:07 → 09:00", () => expect(floorTo15("09:07")).toBe("09:00"));
  it("10:22 → 10:15", () => expect(floorTo15("10:22")).toBe("10:15"));
  it("09:16 → 09:15", () => expect(floorTo15("09:16")).toBe("09:15"));
  it("allerede på kvarter bevares (09:15)", () => expect(floorTo15("09:15")).toBe("09:15"));
});

describe("ceilTo15 (slut rundes op)", () => {
  it("10:22 → 10:30", () => expect(ceilTo15("10:22")).toBe("10:30"));
  it("09:07 → 09:15", () => expect(ceilTo15("09:07")).toBe("09:15"));
  it("10:44 → 10:45", () => expect(ceilTo15("10:44")).toBe("10:45"));
  it("allerede på kvarter bevares (10:30)", () => expect(ceilTo15("10:30")).toBe("10:30"));
});
