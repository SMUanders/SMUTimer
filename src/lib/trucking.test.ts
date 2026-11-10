import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdapter } from "./storage/supabaseAdapter";
import { buildEntry } from "./segment";
import { buildEntries } from "./entries";
import { fordelMinutter } from "./fordeling";
import { getLunchWindow } from "./lunch";
import type { EntryDraft, FordeltEnhed, TimeEntry } from "../types";

// Trucking V1 — enhederne følger registreringen hele vejen (aktiv opgave → historik → rettelse),
// og frokost-delte dele fordeler hver sin tid, så summen stadig er den samlede arbejdstid.

const fe = (id: string, sag: string, smu: string, loeb: number): FordeltEnhed => ({
  enhedId: id,
  sagId: sag,

  sagSmuNummer: smu,
  visning: `#${loeb}`,
});
const tre = [fe("e1", "A", "SMU-0043L", 1), fe("e2", "A", "SMU-0043L", 2), fe("e3", "B", "SMU-0012L", 1)];

function fakeClient(rpc: (name: string, args: unknown) => Promise<{ data: unknown; error: unknown }>) {
  return { rpc } as unknown as SupabaseClient;
}

describe("supabaseAdapter — Trucking", () => {
  it("getEnhederPaaPladsen kalder Pladsliste-kontrakten og mapper felter", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          enhed_id: "e1", sag_id: "A", smu_nummer: "SMU-0043L", sag_titel: "Folie", kunde: "Kunde", sag_aaben: true,
          loebenummer: 1, beskrivelse: null, reg_nr: "AD6649", stelnummer: null, trailer_nr: null, internt_nr: null,
          ophold_id: "o1", ankommet_at: "2026-11-10T07:00:00Z", zone: "Klar til afhentning",
        },
      ],
      error: null,
    });
    const store = createSupabaseAdapter(fakeClient(rpc));
    const res = await store.getEnhederPaaPladsen();
    expect(rpc).toHaveBeenCalledWith("pladsliste_tid_enheder_paa_pladsen", { p_q: null });
    expect(res).toEqual([
      {
        enhedId: "e1", sagId: "A", smuNummer: "SMU-0043L", sagTitel: "Folie", kunde: "Kunde", loebenummer: 1,
        beskrivelse: null, regNr: "AD6649", stelnummer: null, trailerNr: null, interntNr: null, zone: "Klar til afhentning",
      },
    ]);
  });
  it("fejler blødt → tom liste", async () => {
    const store = createSupabaseAdapter(fakeClient(vi.fn().mockResolvedValue({ data: null, error: { message: "x" } })));
    expect(await store.getEnhederPaaPladsen()).toEqual([]);
  });
  it("updateOwnEntry sender enhederne (8 parametre); [] = ingen; udeladt = bevar (7 parametre)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "ny", error: null });
    const store = createSupabaseAdapter(fakeClient(rpc));
    const entry = { id: "r1", updatedAt: "2026-11-10T10:00:00.123456+00:00" } as TimeEntry;
    const patch = { startTime: "10:00", endTime: "10:45", categoryId: "montage-internt", subcategoryId: "montage-internt__trucking", note: "" };
    await store.updateOwnEntry(entry, { ...patch, fordelteEnheder: tre.slice(0, 1) });
    expect(rpc.mock.calls[0][1].p_enheder).toEqual([{ enhed_id: "e1", sag_id: "A", sag_smu_nummer: "SMU-0043L", visning: "#1" }]);
    await store.updateOwnEntry(entry, { ...patch, fordelteEnheder: [] });
    expect(rpc.mock.calls[1][1].p_enheder).toEqual([]);
    await store.updateOwnEntry(entry, patch);
    expect("p_enheder" in rpc.mock.calls[2][1]).toBe(false);
  });
});

describe("enhederne følger registreringen", () => {
  it("afslut trucking: én registrering med alle enheder (ingen tid pr. enhed)", () => {
    const e = buildEntry({
      employeeId: "S", workDate: "2026-11-10", startTime: "10:00", endTime: "10:45",
      categoryId: "montage-internt", subcategoryId: "montage-internt__trucking", orderNumber: "", note: "",
      fordelteEnheder: tre, newId: () => "id", nowIso: "2026-11-10T10:45:00Z",
    });
    expect(e.durationMinutes).toBe(45);
    expect(e.fordelteEnheder.map((x) => x.enhedId)).toEqual(["e1", "e2", "e3"]);
    expect(fordelMinutter(e.durationMinutes, e.fordelteEnheder.length)).toEqual([15, 15, 15]);
  });
  it("lederens rettelse over frokost: hver arbejdsdel bærer enhederne; pausen ingen; summen = arbejdstiden", () => {
    const draft: EntryDraft = {
      fordelteEnheder: tre, startTime: "11:30", endTime: "13:00", categoryId: "montage-internt",
      subcategoryId: "montage-internt__trucking", customer: "", sagId: null, sagSmuNummer: null, enhedId: null,
      enhedVisning: null, note: "", isRedo: false, redoReason: null, redoNote: "",
    };
    const dele = buildEntries(draft, "2026-11-10", { employeeId: "S", lunch: getLunchWindow("2026-11-10"), newId: () => Math.random().toString(), now: () => "t" });
    const arbejde = dele.filter((d) => !d.isBreak);
    const pause = dele.filter((d) => d.isBreak);
    expect(pause.every((p) => p.fordelteEnheder.length === 0)).toBe(true);
    expect(arbejde.every((a) => a.fordelteEnheder.length === 3)).toBe(true);
    const fordelt = arbejde.flatMap((a) => fordelMinutter(a.durationMinutes, 3)).reduce((x, y) => x + y, 0);
    expect(fordelt).toBe(arbejde.reduce((x, a) => x + a.durationMinutes, 0));
  });
});
