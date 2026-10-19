import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdapter } from "./supabaseAdapter";

// Fake klient der kun stubber .rpc (searchSager bruger kun rpc). .from bruges ikke her.
function fakeClient(rpc: (name: string, args: unknown) => Promise<{ data: unknown; error: unknown }>) {
  return { rpc } as unknown as SupabaseClient;
}

describe("supabaseAdapter.searchSager — kalder OS read-contract og mapper felter", () => {
  it("kalder tid_sag_search med trimmet q og mapper rækker til SagRef", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { sag_id: "u1", smu_nummer: "SMU-0123", titel: "5 Volvo trækkere", kunde_navn: "H.P. Therkelsen" },
      ],
      error: null,
    });
    const store = createSupabaseAdapter(fakeClient(rpc));
    const res = await store.searchSager("  volvo  ");
    expect(rpc).toHaveBeenCalledWith("tid_sag_search", { q: "volvo" });
    expect(res).toEqual([
      { sagId: "u1", smuNummer: "SMU-0123", titel: "5 Volvo trækkere", kundeNavn: "H.P. Therkelsen" },
    ]);
  });

  it("søger IKKE ved under 2 tegn (ingen giant dropdown / unødigt kald)", async () => {
    const rpc = vi.fn();
    const store = createSupabaseAdapter(fakeClient(rpc));
    expect(await store.searchSager("a")).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("getSagEnheder kalder tid_sag_enheder med p_sag_id og mapper felter", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          enhed_id: "e3",
          loebenummer: 3,
          beskrivelse: "Schmitz trailer",
          reg_nr: "AB12345",
          stelnummer: null,
          trailer_nr: "T7",
          internt_nr: null,
        },
      ],
      error: null,
    });
    const store = createSupabaseAdapter(fakeClient(rpc));
    const res = await store.getSagEnheder("sag-1");
    expect(rpc).toHaveBeenCalledWith("tid_sag_enheder", { p_sag_id: "sag-1" });
    expect(res).toEqual([
      {
        enhedId: "e3",
        loebenummer: 3,
        beskrivelse: "Schmitz trailer",
        regNr: "AB12345",
        stelnummer: null,
        trailerNr: "T7",
        interntNr: null,
      },
    ]);
  });

  it("getSagEnheder fejler blødt → tom liste (vælgeren skjules)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "denied" } });
    const store = createSupabaseAdapter(fakeClient(rpc));
    expect(await store.getSagEnheder("sag-1")).toEqual([]);
  });

  it("fejler blødt → tom liste (ingen crash i UI)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "denied" } });
    const store = createSupabaseAdapter(fakeClient(rpc));
    expect(await store.searchSager("SMU")).toEqual([]);
  });
});
