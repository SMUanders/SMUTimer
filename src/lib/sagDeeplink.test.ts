import { describe, expect, it } from "vitest";
import { sagFraUrl } from "./sagDeeplink";

const ID = "dd704771-c387-4753-8429-f2e2fc22966b";

describe("sagFraUrl", () => {
  it("læser sag og smu", () => {
    expect(sagFraUrl(`?sag=${ID}&smu=SMU-0115`)).toEqual({ sagId: ID, smuNummer: "SMU-0115" });
  });
  it("smu er valgfri", () => {
    expect(sagFraUrl(`?sag=${ID.toUpperCase()}`)).toEqual({ sagId: ID, smuNummer: null });
  });
  it("afviser manglende eller ugyldigt id", () => {
    expect(sagFraUrl("")).toBeNull();
    expect(sagFraUrl("?smu=SMU-0115")).toBeNull();
    expect(sagFraUrl("?sag=SMU-0115")).toBeNull();
    expect(sagFraUrl("?sag=' or 1=1")).toBeNull();
  });
});
