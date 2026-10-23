import { describe, it, expect } from "vitest";
import {
  suggestStart,
  suggestEnd,
  suggestSwitchAt,
  lederAfslutForslag,
  lederOpgaveStart,
  activeStartHHMM,
  ownCloseUntil,
  helpStartHHMM,
  helpEndHHMM,
  finishError,
  findOverlap,
  konfliktVed,
  senesteRegistrering,
  buildEntry,
  isExactDuplicate,
  hhmmToIsoToday,
  lastEntryEndHHMM,
} from "./segment";
import { buildDayTimeline } from "./dayTimeline";
import { HELP_NOTE, helpNote, isHelpNote } from "./helpContext";
import { floorTo5, toMinutes } from "./time";
import type { TimeEntry } from "../types";

const ctx = {
  employeeId: "anders",
  workDate: "2026-08-19",
  newId: () => "id-1",
  nowIso: "2026-08-19T10:07:00.000Z",
};

function te(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "x", employeeId: "anders", workDate: "2026-08-19",
    startTime: "08:00", endTime: "10:00", durationMinutes: 120,
    categoryId: "montage-ude", subcategoryId: null, customer: "54277", sagId: null, sagSmuNummer: null, enhedId: null, enhedVisning: null, note: "",
    isBreak: false, isRedo: false, redoReason: null, redoNote: "",
    splitGroupId: null, slettet: false, createdAt: "", updatedAt: "",
    ...overrides,
  };
}
function line(startTime: string, endTime: string, o: Partial<TimeEntry> = {}): TimeEntry {
  return te({ id: `${startTime}-${endTime}`, startTime, endTime, durationMinutes: toMinutes(endTime) - toMinutes(startTime), ...o });
}
const efter = (a: string, b: string) => toMinutes(a) > toMinutes(b);

describe("floorTo5", () => {
  it("runder altid NED til 5 min", () => {
    expect(floorTo5("10:48")).toBe("10:45");
    expect(floorTo5("10:45")).toBe("10:45");
    expect(floorTo5("10:44")).toBe("10:40");
    expect(floorTo5("00:03")).toBe("00:00");
  });
});

describe("suggestStart — nu rundet ned, aldrig før seneste sluttid, aldrig efter nu", () => {
  it("runder ned til 5 min", () => {
    expect(suggestStart("15:12", "15:12")).toBe("15:10");
  });
  it("klampes til seneste sluttid (intet overlap)", () => {
    expect(suggestStart("15:12", "15:12", "15:11")).toBe("15:11");
  });
  it("seneste sluttid efter nu: næste start følger den (løsning A, Pakke 1.1)", () => {
    expect(suggestStart("15:40", "15:40", "16:00")).toBe("16:00");
  });
  it("et tidspunkt efter nu foreslås aldrig", () => {
    expect(suggestStart("16:30", "15:42")).toBe("15:40");
  });
});

describe("suggestEnd — aldrig efter nu, altid efter start når muligt", () => {
  it("nu rundet ned, når det ligger efter start", () => {
    expect(suggestEnd("15:15", "15:28")).toBe("15:25");
  });
  it("kort opgave forsvinder ikke: faktisk minut bruges", () => {
    expect(suggestEnd("15:30", "15:33")).toBe("15:33");
  });
  it("kort opgave krymper ikke (15:39–15:42 bliver ikke 15:39–15:40)", () => {
    expect(suggestEnd("15:39", "15:42")).toBe("15:42");
  });
  it("længere opgave: rundet ned til 5 min", () => {
    expect(suggestEnd("15:39", "15:47")).toBe("15:45");
  });
  it("under ét minut → slut = start (formen viser det som ugyldigt)", () => {
    expect(suggestEnd("15:30", "15:30")).toBe("15:30");
  });
  it("aldrig fremtidig sluttid, når starten er nået (tidligere +15 min)", () => {
    for (const [start, now] of [["15:30", "15:32"], ["15:45", "15:47"], ["10:00", "10:00"], ["09:12", "11:58"]]) {
      expect(efter(suggestEnd(start, now), now)).toBe(false);
    }
  });
});

describe("suggestEnd — start efter nu (Pakke 1.1)", () => {
  it("starten ligger efter nu → næste 5-minutters tidspunkt efter starten", () => {
    expect(suggestEnd("09:45", "09:33")).toBe("09:50");
    expect(suggestEnd("09:47", "09:33")).toBe("09:50");
  });
  it("aldrig ud over 23:59", () => {
    expect(suggestEnd("23:57", "23:00")).toBe("23:59");
    expect(suggestEnd("23:59", "23:00")).toBe("23:59");
  });
});

describe("activeStartHHMM — kortets start = afslutningens start", () => {
  it("gemt start bruges uændret", () => {
    expect(activeStartHHMM(hhmmToIsoToday("15:35"), hhmmToIsoToday("15:36"), "15:40", "15:35")).toBe("15:35");
  });
  it("uden gemt start: forslag ud fra updatedAt (rundet ned)", () => {
    expect(activeStartHHMM(null, hhmmToIsoToday("15:37"), "15:50")).toBe("15:35");
  });
  it("aldrig før seneste sluttid (fx en linje tilføjet af leder bagefter)", () => {
    expect(activeStartHHMM(hhmmToIsoToday("15:00"), hhmmToIsoToday("15:00"), "15:50", "15:20")).toBe("15:20");
  });
  it("gemt start efter nu bruges uændret (næste opgave efter en registrering, der slutter senere)", () => {
    expect(activeStartHHMM(hhmmToIsoToday("16:00"), hhmmToIsoToday("15:33"), "15:40", "16:00")).toBe("16:00");
  });
});

describe("skifte (pause/omgøring/hjælp) fra en aktiv opgave", () => {
  it("egen opgave lukkes præcis ved skiftet", () => {
    expect(ownCloseUntil("09:00", "10:15")).toEqual({ startTime: "09:00", endTime: "10:15" });
  });
  it("under ét minut → ingen egen-linje", () => {
    expect(ownCloseUntil("10:00", "10:00")).toBeNull();
  });
  it("skiftetidspunkt: nu rundet ned, men efter egen start", () => {
    expect(suggestSwitchAt("09:00", "10:22")).toBe("10:20");
  });
});

describe("hjælp er et stopur — præcise minutter, intet minimum", () => {
  it("3 minutters hjælp registreres som 3 minutter", () => {
    const hs = helpStartHHMM("15:31");
    expect(hs).toBe("15:31");
    expect(helpEndHHMM(hs, "15:34")).toBe("15:34");
  });
  it("tidligere minimum på 5 min er fjernet", () => {
    expect(helpEndHHMM("10:35", "10:37")).toBe("10:37");
  });
  it("under ét minut → ingen hjælp-linje", () => {
    expect(helpEndHHMM("10:35", "10:35")).toBeNull();
  });
  it("start er det faktiske minut — aldrig forskudt", () => {
    expect(helpStartHHMM("15:31")).toBe("15:31");
  });
  it("valgt 'start fra' en senere sluttid: faktisk varighed placeres efter den valgte start", () => {
    expect(helpEndHHMM("09:45", "09:41", 3)).toBe("09:48");
    expect(helpEndHHMM("09:45", "09:41", 0)).toBeNull();
    expect(helpEndHHMM("23:58", "23:50", 5)).toBe("23:59");
  });
});

describe("finishError — validering før gem (Pakke 1.1)", () => {
  const dag = [line("15:00", "15:30")];
  it("slut skal være efter start", () => {
    expect(finishError("15:30", "15:30", [])).toMatch(/efter start/);
  });
  it("slut efter nu er tilladt (manuel registrering, til og med 23:59)", () => {
    expect(finishError("09:00", "09:45", [])).toBeNull();
    expect(finishError("22:00", "23:59", [])).toBeNull();
  });
  it("overlap afvises med den registrering, der konflikter", () => {
    expect(finishError("15:15", "15:40", dag)).toMatch(/15:00–15:30/);
    expect(findOverlap("15:15", "15:40", dag)?.startTime).toBe("15:00");
  });
  it("back-to-back er OK", () => {
    expect(finishError("15:30", "15:40", dag)).toBeNull();
  });
  it("slettede linjer ignoreres", () => {
    expect(finishError("15:15", "15:40", [line("15:00", "15:30", { slettet: true })])).toBeNull();
  });
});

describe("konfliktVed — medarbejderen vælger selv (Pakke 1.1)", () => {
  const dag = [line("08:00", "09:00"), line("09:00", "09:45", { id: "seneste" })];
  it("09:00–09:45 gemt kl. 09:32; ny aktivitet kl. 09:38 → konflikt med begge valg", () => {
    const k = konfliktVed("09:38", dag, "09:45")!;
    expect(k.tidspunkt).toBe("09:38");
    expect(k.registreretSlut).toBe("09:45");
    expect(k.afkort?.id).toBe("seneste");
  });
  it("ingen konflikt, når aktiviteten starter ved eller efter den registrerede slut", () => {
    expect(konfliktVed("09:45", dag, "09:45")).toBeNull();
    expect(konfliktVed("10:00", dag, "09:45")).toBeNull();
    expect(konfliktVed("09:38", [], null)).toBeNull();
  });
  it("afkort tilbydes ikke, når tidspunktet ligger før den seneste registrerings start", () => {
    expect(konfliktVed("08:30", dag, "09:45")!.afkort).toBeNull();
  });
  it("afkort tilbydes ikke for en registrering delt omkring frokost", () => {
    expect(konfliktVed("12:40", [line("12:30", "13:00", { splitGroupId: "g" })], "13:00")!.afkort).toBeNull();
  });
  it("afkort tilbydes ikke, når seneste sluttid kommer fra fravær", () => {
    expect(konfliktVed("09:38", dag, "10:00")!.afkort).toBeNull();
  });
  it("seneste = højeste sluttid (samme definition som databasen)", () => {
    expect(senesteRegistrering(dag)?.id).toBe("seneste");
    expect(senesteRegistrering([line("08:00", "09:00", { slettet: true })])).toBeNull();
  });
});

describe("REGRESSION — Manus QA 22. okt. 2026", () => {
  it("A1: pause i samme kvarter som opgaven sluger ikke længere opgavens tid", () => {
    const egen = suggestStart("15:12", "15:12"); // 15:10
    const pauseStart = suggestSwitchAt(egen, "15:14"); // 15:14 (ikke 15:15 og ikke opslugt)
    expect(ownCloseUntil(egen, pauseStart)).toEqual({ startTime: "15:10", endTime: "15:14" });
  });

  it("A2: omgøringens start i formen = kortets start (tidligere 15:35 → 15:30 = overlap)", () => {
    const kort = activeStartHHMM(hhmmToIsoToday("15:35"), hhmmToIsoToday("15:35"), "15:38", "15:35");
    expect(kort).toBe("15:35");
    // Afslutningen foreslår start = kortets start, slut aldrig efter nu.
    const slut = suggestEnd(kort, "15:38");
    expect(slut).toBe("15:38");
    expect(finishError(kort, slut, [line("15:30", "15:35", { note: HELP_NOTE })])).toBeNull();
  });

  it("A3 (Pakke 1.1): 09:00–09:45 gemt kl. 09:32 → næste opgave foreslås fra 09:45, uden overlap", () => {
    const dag = [line("09:00", "09:45")];
    expect(finishError("09:00", "09:45", [])).toBeNull(); // slut efter nu accepteres
    const le = lastEntryEndHHMM(dag);
    const start = suggestStart("09:33", "09:33", le);
    expect(start).toBe("09:45");
    expect(activeStartHHMM(hhmmToIsoToday(start), hhmmToIsoToday("09:33"), "09:50", le)).toBe("09:45");
    expect(finishError(start, suggestEnd(start, "09:50"), dag)).toBeNull();
  });

  it("B-02 (Manus Test B): lederens afslutning foreslår præcis aktivkortets start (08:47, ikke 08:45)", () => {
    const opdateret = hhmmToIsoToday("08:47");
    expect(lederOpgaveStart(opdateret)).toBe("08:47");
    const t = lederAfslutForslag(opdateret, hhmmToIsoToday("09:20"));
    expect(t.startTime).toBe("08:47");
    expect(t.endTime).toBe("09:20");
    expect(lederAfslutForslag(opdateret, hhmmToIsoToday("08:49")).endTime).toBe("08:49");
  });

  it("B-01 (Manus Test B): tomt eller ufærdigt tidsfelt giver en fejltekst, ikke et nedbrud", () => {
    expect(() => finishError("08:00", "", [])).not.toThrow();
    expect(finishError("08:00", "", [])).toMatch(/Angiv både start og slut/);
    expect(finishError("", "09:00", [])).toMatch(/Angiv både start og slut/);
    expect(findOverlap("08:00", "", [line("07:00", "09:00")])).toBeNull();
    expect(konfliktVed("", [line("07:00", "09:00")], "09:00")).toBeNull();
  });

  it("Hele Manus-forløbet med de nye regler: intet overlap, ingen fremtidig slut, intet opslugt", () => {
    const linjer: TimeEntry[] = [];
    const gem = (start: string, slut: string, nu: string, o: Partial<TimeEntry> = {}) => {
      void nu;
      expect(finishError(start, slut, linjer)).toBeNull();
      linjer.push(line(start, slut, o));
    };
    // 15:12 start montage
    let egen = suggestStart("15:12", "15:12", lastEntryEndHHMM(linjer)); // 15:10
    // 15:14 pause fra aktiv opgave
    const p = suggestSwitchAt(egen, "15:14");
    gem(ownCloseUntil(egen, p)!.startTime, p, "15:14");
    // 15:27 genoptag efter pause
    gem(p, suggestEnd(p, "15:27"), "15:27", { categoryId: "pause", isBreak: true });
    egen = suggestEnd(p, "15:27"); // genoptaget fra pausens slut (15:25)
    // 15:30 hjælp
    const hs = helpStartHHMM("15:30");
    gem(ownCloseUntil(egen, hs)!.startTime, hs, "15:30");
    // 15:33 stop hjælp (3 min)
    const he = helpEndHHMM(hs, "15:33")!;
    gem(hs, he, "15:33", { note: helpNote("hjælpenote") });
    egen = he;
    // 15:36 omgøring fra aktiv opgave
    const rs = suggestSwitchAt(egen, "15:36");
    gem(ownCloseUntil(egen, rs)!.startTime, rs, "15:36");
    // 15:39 afslut omgøring (formen foreslår kortets start)
    gem(rs, suggestEnd(rs, "15:39"), "15:39", { isRedo: true, redoReason: "monteringsfejl" });
    egen = suggestEnd(rs, "15:39");
    // 15:42 afslut montage
    gem(egen, suggestEnd(egen, "15:42"), "15:42");

    expect(linjer.map((l) => `${l.startTime}-${l.endTime}`)).toEqual([
      "15:10-15:14", "15:14-15:25", "15:25-15:30", "15:30-15:33", "15:33-15:36", "15:36-15:39", "15:39-15:42",
    ]);
    // Korte opgaver bevarer deres faktiske længde (3 min omgøring = 3 min, sidste montage = 3 min).
    expect(linjer[linjer.length - 1].durationMinutes).toBe(3);
    const dag = buildDayTimeline(linjer);
    expect(dag.every((b) => !b.conflict)).toBe(true); // intet overlap
    expect(dag.some((b) => b.kind === "gap")).toBe(false); // intet hul
    expect(linjer.find((l) => isHelpNote(l.note))?.durationMinutes).toBe(3); // 3 min hjælp = 3 min
  });

  it("C: hjælpenoten bevares på den gemte hjælp-linje", () => {
    const n = helpNote("hjælpenote");
    expect(n).toBe(`${HELP_NOTE} — hjælpenote`);
    expect(isHelpNote(n)).toBe(true);
    expect(helpNote("")).toBe(HELP_NOTE);
  });
});

describe("omgøring — markering", () => {
  it("buildEntry markerer omgøring med årsag/note", () => {
    const e = buildEntry({
      ...ctx, startTime: "10:00", endTime: "10:20", categoryId: "montage-ude", subcategoryId: null,
      orderNumber: "54442", note: "", isRedo: true, redoReason: "produktionsfejl", redoNote: "forkert mål",
    });
    expect(e.isRedo).toBe(true);
    expect(e.redoReason).toBe("produktionsfejl");
    expect(e.redoNote).toBe("forkert mål");
  });
  it("buildEntry uden redo-flag → ingen årsag", () => {
    const e = buildEntry({ ...ctx, startTime: "10:00", endTime: "10:20", categoryId: "montage-ude", subcategoryId: null, orderNumber: "1", note: "" });
    expect(e.isRedo).toBe(false);
    expect(e.redoReason).toBeNull();
  });
});

describe("lastEntryEndHHMM", () => {
  it("seneste sluttid samme dag", () => {
    expect(lastEntryEndHHMM([te({ startTime: "08:00", endTime: "09:15" }), te({ startTime: "07:00", endTime: "08:00" })])).toBe("09:15");
  });
  it("tom dag → null", () => {
    expect(lastEntryEndHHMM([])).toBeNull();
  });
  it("slettede linjer ignoreres", () => {
    expect(lastEntryEndHHMM([te({ endTime: "10:00", slettet: true })])).toBeNull();
  });
});

describe("buildEntry", () => {
  it("bygger arbejds-linje med de bekræftede tider", () => {
    const e = buildEntry({ ...ctx, startTime: "08:15", endTime: "11:45", categoryId: "montage-ude", subcategoryId: null, orderNumber: "54277", note: "note" });
    expect(e.startTime).toBe("08:15");
    expect(e.endTime).toBe("11:45");
    expect(e.durationMinutes).toBe(210);
    expect(e.isBreak).toBe(false);
    expect(e.customer).toBe("54277");
  });
  it("pause-kategori → is_break=true", () => {
    const e = buildEntry({ ...ctx, startTime: "12:00", endTime: "12:30", categoryId: "pause", subcategoryId: "pause__frokost", orderNumber: "", note: "" });
    expect(e.isBreak).toBe(true);
  });
  it("lægger ALDRIG stille tid til: slut ≤ start kaster (tidligere +15 → fremtidig slut)", () => {
    expect(() =>
      buildEntry({ ...ctx, startTime: "15:45", endTime: "15:45", categoryId: "montage-ude", subcategoryId: null, orderNumber: "", note: "" })
    ).toThrow(/slut skal være efter start/);
  });
});

describe("isExactDuplicate (kun nøjagtig dublet)", () => {
  it("identisk linje → true", () => {
    expect(isExactDuplicate(te(), [te()])).toBe(true);
  });
  it("back-to-back (ikke dublet) → false", () => {
    const nyt = te({ startTime: "10:00", endTime: "11:00", customer: "99999" });
    expect(isExactDuplicate(nyt, [te({ startTime: "08:00", endTime: "10:00" })])).toBe(false);
  });
  it("slettede linjer ignoreres", () => {
    expect(isExactDuplicate(te(), [te({ slettet: true })])).toBe(false);
  });
});
