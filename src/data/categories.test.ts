import { describe, it, expect } from "vitest";
import { defaultSubcategoryFor, getSubcategory, getCategory } from "./categories";

describe("defaultSubcategoryFor — montage forvælger Montering", () => {
  it("Montage internt → Montering", () => {
    expect(defaultSubcategoryFor("montage-internt")).toBe("montage-internt__montering");
  });
  it("Montage ude → Montering", () => {
    expect(defaultSubcategoryFor("montage-ude")).toBe("montage-ude__montering");
  });

  it("andre kategorier falder tilbage på første underpunkt", () => {
    const teg = getCategory("tegnestue-grafik");
    expect(defaultSubcategoryFor("tegnestue-grafik")).toBe(teg?.subcategories[0].id);
    const upro = getCategory("uproduktiv-tid");
    expect(defaultSubcategoryFor("uproduktiv-tid")).toBe(upro?.subcategories[0].id);
  });

  it("ukendt kategori → null", () => {
    expect(defaultSubcategoryFor("findes-ikke")).toBeNull();
  });

  it("montage-defaults er kun defaults — de øvrige aktiviteter findes stadig", () => {
    expect(getSubcategory("montage-internt", "montage-internt__trucking")?.name).toBe("Trucking");
    expect(getSubcategory("montage-internt", "montage-internt__afmontering")?.name).toBe("Afmontering");
    expect(getSubcategory("montage-ude", "montage-ude__koersel")?.name).toBe("Kørsel");
  });
});

describe("Rengøring findes under Uproduktiv tid (generel, ikke person-specifik)", () => {
  it("Rengøring er et underpunkt af Uproduktiv tid", () => {
    expect(getSubcategory("uproduktiv-tid", "uproduktiv-tid__rengoering")?.name).toBe("Rengøring");
  });
  it("eksisterende Uproduktiv tid-aktiviteter er bevaret", () => {
    for (const id of ["morgenmoede", "oprydning", "lager", "vedligehold"]) {
      expect(getSubcategory("uproduktiv-tid", `uproduktiv-tid__${id}`)).toBeDefined();
    }
  });
});
