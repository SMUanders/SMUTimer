import { describe, it, expect } from "vitest";
import {
  suggestFinishTimes,
  buildEntry,
  isExactDuplicate,
  hhmmToIsoToday,
  helpStartHHMM,
  helpStopEndHHMM,
  helpOwnCloseTimes,
  redoStartHHMM,
  redoOwnCloseTimes,
  lastEntryEndHHMM,
} from "./segment";
import { buildDayTimeline } from "./dayTimeline";
import { HELP_NOTE } from "./helpContext";
import { roundTo15, roundTo5, ceilTo5 } from "./time";
import { isoToHHMM } from "./currentTaskStart";
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
    categoryId: "montage-ude", subcategoryId: null, customer: "54277", note: "",
    isBreak: false, isRedo: false, redoReason: null, redoNote: "",
    splitGroupId: null, slettet: false, createdAt: "", updatedAt: "",
    ...overrides,
  };
}

describe("suggestFinishTimes (nærmeste-kvarter, ingen kæde-overlap)", () => {
  it("runder start og slut til nærmeste kvarter (tidszone-uafhængigt)", () => {
    const startIso = "2026-08-19T08:52:00.000Z";
    const t = suggestFinishTimes(startIso, ctx.nowIso);
    expect(t.startTime).toBe(roundTo15(isoToHHMM(startIso)));
    expect(t.endTime).toBe(roundTo15(isoToHHMM(ctx.nowIso)));
  });

  it("back-to-back segmenter rører hinanden (samme skifte-instant → samme kvarter)", () => {
    // To segmenter der skifter på samme tidspunkt: A's slut = B's start.
    const switchIso = "2026-08-19T12:07:00.000Z";
    const aEnd = suggestFinishTimes("2026-08-19T09:00:00.000Z", switchIso).endTime;
    const bStart = suggestFinishTimes(switchIso, "2026-08-19T13:20:00.000Z").startTime;
    expect(aEnd).toBe(bStart); // rører, ingen overlap
  });

  it("slut ≤ start → minimum ét kvarter", () => {
    const t = suggestFinishTimes("2026-08-19T10:00:00.000Z", "2026-08-19T10:00:00.000Z");
    expect(Number(t.endTime.replace(":", ""))).toBeGreaterThan(Number(t.startTime.replace(":", "")));
  });
});

describe("5-min afrunding (hjælp-stopur)", () => {
  it("roundTo5 → nærmeste 5", () => {
    expect(roundTo5("10:33")).toBe("10:35");
    expect(roundTo5("10:32")).toBe("10:30");
    expect(roundTo5("10:00")).toBe("10:00");
  });
  it("ceilTo5 → op til næste 5", () => {
    expect(ceilTo5("10:46")).toBe("10:50");
    expect(ceilTo5("10:45")).toBe("10:45");
    expect(ceilTo5("10:41")).toBe("10:45");
  });
});

describe("hjælp mini-stopur (helpStartHHMM / helpStopEndHHMM)", () => {
  it("start rundes til nærmeste 5 min", () => {
    expect(helpStartHHMM(hhmmToIsoToday("10:33"))).toBe("10:35");
  });
  it("slut rundes OP til næste 5 min", () => {
    expect(helpStopEndHHMM("10:35", hhmmToIsoToday("10:48"))).toBe("10:50");
  });
  it("minimum 5 minutters hjælp (2 min faktisk → 5 min)", () => {
    expect(helpStopEndHHMM("10:35", hhmmToIsoToday("10:37"))).toBe("10:40");
  });
  it("0 min faktisk hjælp → stadig mindst 5 min", () => {
    expect(helpStopEndHHMM("10:35", hhmmToIsoToday("10:35"))).toBe("10:40");
  });
  it("eksempel fra spec: 10:35 start, ~10:48 stop → 10:35–10:50", () => {
    const start = "10:35";
    const end = helpStopEndHHMM(start, hhmmToIsoToday("10:48"));
    expect(start).toBe("10:35");
    expect(end).toBe("10:50");
    // genoptaget egen opgave starter ved hjælpens sluttid → intet overlap
    expect(Number(end.replace(":", ""))).toBeGreaterThan(Number(start.replace(":", "")));
  });
});

describe("hjælp-split — egen opgave lukkes uden overlap", () => {
  it("start hjælp lukker egen opgave frem til hjælp-start", () => {
    const hs = helpStartHHMM(hhmmToIsoToday("13:44")); // 13:45
    const own = helpOwnCloseTimes(hhmmToIsoToday("13:30"), hs)!;
    expect(own.startTime).toBe("13:30");
    expect(own.endTime).toBe(hs); // egen slutter PRÆCIS ved hjælpens start
    expect(hs).toBe("13:45");
  });

  it("egen opgave aktiv < ét interval → ingen egen-linje (ingen baguddatering)", () => {
    const hs = helpStartHHMM(hhmmToIsoToday("13:41")); // 13:40
    expect(helpOwnCloseTimes(hhmmToIsoToday("13:40"), hs)).toBeNull();
  });

  it("normalt hjælp-flow: egen → hjælp → genoptag rører uden overlap", () => {
    const ownStart = hhmmToIsoToday("13:30");
    const hs = helpStartHHMM(hhmmToIsoToday("13:34")); // 13:35 (hjælp-start)
    const own = helpOwnCloseTimes(ownStart, hs)!; // 13:30–13:35
    const he = helpStopEndHHMM(hs, hhmmToIsoToday("13:38")); // 13:40 (hjælp-slut)

    expect(own.endTime).toBe(hs); // egen slut == hjælp start
    expect(he).toBe("13:40");
    // genoptaget egen starter ved he — byg Min dag og bekræft INGEN konflikt
    const day = buildDayTimeline([
      teLine(own.startTime, own.endTime, "montage-ude", ""),
      teLine(hs, he, "montage-ude", HELP_NOTE),
      teLine(he, "14:00", "montage-ude", ""), // genoptaget egen opgave
    ]);
    expect(day.filter((b) => b.kind !== "gap").every((b) => !b.conflict)).toBe(true);
    expect(day.some((b) => b.kind === "help")).toBe(true);
  });

  it("hurtig hjælp-kæde: intet fabrikeret overlap (egen-linje droppes)", () => {
    // egen genoptaget 13:40, hjælp igen straks 13:41 → hs=13:40 → ingen egen-linje
    const hs = helpStartHHMM(hhmmToIsoToday("13:41"));
    expect(helpOwnCloseTimes(hhmmToIsoToday("13:40"), hs)).toBeNull();
  });
});

function teLine(startTime: string, endTime: string, categoryId: string, note: string): TimeEntry {
  return te({ startTime, endTime, categoryId, note, isBreak: categoryId === "pause" });
}

describe("omgøring — split uden overlap + markering", () => {
  it("buildEntry markerer omgøring med årsag/note", () => {
    const e = buildEntry({
      ...ctx,
      startTime: "10:00",
      endTime: "10:20",
      categoryId: "montage-ude",
      subcategoryId: null,
      orderNumber: "54442",
      note: "",
      isRedo: true,
      redoReason: "produktionsfejl",
      redoNote: "forkert mål",
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

  it("redoStartHHMM runder til nærmeste kvarter", () => {
    expect(redoStartHHMM(hhmmToIsoToday("10:22"))).toBe("10:15");
    expect(redoStartHHMM(hhmmToIsoToday("10:23"))).toBe("10:30");
  });

  it("start omgøring lukker oprindelig opgave frem til omgøring-start", () => {
    const rs = redoStartHHMM(hhmmToIsoToday("10:20")); // 10:15
    const own = redoOwnCloseTimes(hhmmToIsoToday("09:00"), rs)!;
    expect(own.startTime).toBe("09:00");
    expect(own.endTime).toBe(rs); // egen slut == omgøring start
  });

  it("oprindelig opgave aktiv < ét kvarter → ingen egen-linje", () => {
    const rs = redoStartHHMM(hhmmToIsoToday("10:05")); // 10:00
    expect(redoOwnCloseTimes(hhmmToIsoToday("10:00"), rs)).toBeNull();
  });

  it("omgøring-flow: egen → omgøring → genoptag uden overlap, markeret som omgøring", () => {
    const rs = redoStartHHMM(hhmmToIsoToday("10:20")); // 10:15
    const own = redoOwnCloseTimes(hhmmToIsoToday("09:00"), rs)!; // 09:00–10:15
    const day = buildDayTimeline([
      teLine(own.startTime, own.endTime, "montage-ude", ""),
      te({ startTime: rs, endTime: "10:35", categoryId: "montage-ude", isRedo: true, redoReason: "produktionsfejl" }),
      teLine("10:35", "11:00", "montage-ude", ""), // genoptaget egen
    ]);
    expect(day.filter((b) => b.kind !== "gap").every((b) => !b.conflict)).toBe(true);
    expect(day.some((b) => b.kind === "redo")).toBe(true);
    expect(day.filter((b) => b.kind === "work")).toHaveLength(2); // egen før + efter, IKKE omgøring
  });

  it("selvstændig omgøring (vej B): kæder efter seneste linje, ingen own-close, intet hul/overlap", () => {
    // Ingen aktiv opgave → ingen own-close. Omgøring starter ved seneste sluttid.
    const rs = redoStartHHMM(hhmmToIsoToday("09:03"), "09:00"); // klampet til 09:00
    expect(rs).toBe("09:00");
    const day = buildDayTimeline([
      teLine("08:00", "09:00", "montage-ude", ""), // tidligere sag
      te({ startTime: rs, endTime: "09:15", categoryId: "montage-ude", isRedo: true, redoReason: "tegnestuefejl", redoNote: "rettet mål" }),
    ]);
    expect(day.map((b) => b.kind)).toEqual(["work", "redo"]); // intet hul imellem
    expect(day.every((b) => !b.conflict)).toBe(true); // intet overlap
    expect(day[1].entry?.redoReason).toBe("tegnestuefejl");
  });
});

describe("sammenhængende startforslag = seneste sluttid", () => {
  it("lastEntryEndHHMM = seneste sluttid samme dag", () => {
    expect(
      lastEntryEndHHMM([
        te({ startTime: "08:00", endTime: "09:15" }),
        te({ startTime: "07:00", endTime: "08:00" }),
      ])
    ).toBe("09:15");
  });
  it("tom dag → null (brug første-start-logik)", () => {
    expect(lastEntryEndHHMM([])).toBeNull();
  });
  it("slettede linjer ignoreres", () => {
    expect(lastEntryEndHHMM([te({ endTime: "10:00", slettet: true })])).toBeNull();
  });

  it("næste foreslåede start = seneste sluttid (ikke afrundet før/efter)", () => {
    const last = lastEntryEndHHMM([te({ startTime: "08:45", endTime: "09:15" })]);
    // I appen bruges: start = lastEnd ?? afrundet-fald-tilbage
    expect(last).toBe("09:15");
  });

  it("own-close bruger seneste sluttid som start (intet hul)", () => {
    // Egen opgave efter en linje der sluttede 09:15; hjælp starter 09:30.
    const own = helpOwnCloseTimes(hhmmToIsoToday("09:20"), "09:30", "09:15")!;
    expect(own.startTime).toBe("09:15"); // rører forrige linje — intet hul
    expect(own.endTime).toBe("09:30");
  });

  it("omgøring own-close bruger seneste sluttid som start", () => {
    const own = redoOwnCloseTimes(hhmmToIsoToday("09:20"), "09:30", "09:15")!;
    expect(own.startTime).toBe("09:15");
    expect(own.endTime).toBe("09:30");
  });

  it("split-start klampes: aldrig før seneste sluttid (intet overlap)", () => {
    // Seneste linje slutter 11:45, men nu-afrunding ville give 11:30 → klamp til 11:45.
    expect(redoStartHHMM(hhmmToIsoToday("11:37"), "11:45")).toBe("11:45");
    expect(helpStartHHMM(hhmmToIsoToday("11:43"), "11:45")).toBe("11:45");
    // Uden seneste linje: normal afrunding.
    expect(redoStartHHMM(hhmmToIsoToday("11:37"), null)).toBe("11:30");
  });

  it("system-default skaber hverken hul eller overlap (kædet dag)", () => {
    // normal 08:45–09:15, omgøring 09:15–09:30, normal 09:30–10:00
    const day = buildDayTimeline([
      teLine("08:45", "09:15", "montage-ude", ""),
      te({ startTime: "09:15", endTime: "09:30", categoryId: "montage-ude", isRedo: true, redoReason: "produktionsfejl" }),
      teLine("09:30", "10:00", "montage-ude", ""),
    ]);
    expect(day.every((b) => b.kind !== "gap")).toBe(true); // intet hul
    expect(day.every((b) => !b.conflict)).toBe(true); // intet overlap
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
});

describe("isExactDuplicate (kun nøjagtig dublet)", () => {
  it("identisk linje → true", () => {
    expect(isExactDuplicate(te(), [te()])).toBe(true);
  });
  it("back-to-back (ikke dublet) → false", () => {
    const nyt = te({ startTime: "10:00", endTime: "11:00", customer: "99999" });
    expect(isExactDuplicate(nyt, [te({ startTime: "08:00", endTime: "10:00" })])).toBe(false);
  });
  it("overlap men ikke identisk → false (ingen generel overlap-blokering)", () => {
    const nyt = te({ startTime: "09:00", endTime: "11:00" });
    expect(isExactDuplicate(nyt, [te({ startTime: "08:00", endTime: "10:00" })])).toBe(false);
  });
  it("slettede linjer ignoreres", () => {
    expect(isExactDuplicate(te(), [te({ slettet: true })])).toBe(false);
  });
});
