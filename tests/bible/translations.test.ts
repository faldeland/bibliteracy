import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRANSLATION_ID,
  TRANSLATIONS,
  getTranslation,
  translationCovers,
  translationsFor,
} from "@/lib/bible/translations";

describe("TRANSLATIONS — shape", () => {
  it("contains at least one English-OT-NT covering translation", () => {
    const all = TRANSLATIONS.filter(
      (t) => t.coverage === "ALL" && t.language === "English",
    );
    expect(all.length).toBeGreaterThan(0);
  });

  it("every translation has a unique id", () => {
    const ids = TRANSLATIONS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every translation has a non-empty label and fullName", () => {
    for (const t of TRANSLATIONS) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.fullName.length).toBeGreaterThan(0);
    }
  });

  it("dir matches what we know about each language", () => {
    for (const t of TRANSLATIONS) {
      if (t.language === "Hebrew") expect(t.dir).toBe("rtl");
      else expect(t.dir).toBe("ltr");
    }
  });

  it("DEFAULT_TRANSLATION_ID resolves to a real translation that covers both testaments", () => {
    const def = getTranslation(DEFAULT_TRANSLATION_ID);
    expect(def.id).toBe(DEFAULT_TRANSLATION_ID);
    expect(def.coverage).toBe("ALL");
  });
});

describe("getTranslation", () => {
  it("returns the translation for a known id", () => {
    expect(getTranslation("KJV").id).toBe("KJV");
  });

  it("falls back to the default for unknown ids", () => {
    expect(getTranslation("NotARealId").id).toBe(DEFAULT_TRANSLATION_ID);
  });

  it("falls back to the default for null / undefined / empty", () => {
    expect(getTranslation(null).id).toBe(DEFAULT_TRANSLATION_ID);
    expect(getTranslation(undefined).id).toBe(DEFAULT_TRANSLATION_ID);
    expect(getTranslation("").id).toBe(DEFAULT_TRANSLATION_ID);
  });
});

describe("translationsFor / translationCovers", () => {
  it("returns ALL-coverage and OT-only translations for OT", () => {
    const ot = translationsFor("OT");
    for (const t of ot) {
      expect(t.coverage === "ALL" || t.coverage === "OT").toBe(true);
    }
  });

  it("returns ALL-coverage and NT-only translations for NT", () => {
    const nt = translationsFor("NT");
    for (const t of nt) {
      expect(t.coverage === "ALL" || t.coverage === "NT").toBe(true);
    }
  });

  it("excludes OT-only translations from NT and vice versa", () => {
    const otOnly = TRANSLATIONS.find((t) => t.coverage === "OT");
    const ntOnly = TRANSLATIONS.find((t) => t.coverage === "NT");
    if (otOnly) {
      expect(translationsFor("NT").map((t) => t.id)).not.toContain(otOnly.id);
      expect(translationCovers(otOnly, "NT")).toBe(false);
      expect(translationCovers(otOnly, "OT")).toBe(true);
    }
    if (ntOnly) {
      expect(translationsFor("OT").map((t) => t.id)).not.toContain(ntOnly.id);
      expect(translationCovers(ntOnly, "OT")).toBe(false);
      expect(translationCovers(ntOnly, "NT")).toBe(true);
    }
  });

  it("ALL-coverage translations are returned for both testaments", () => {
    const all = TRANSLATIONS.filter((t) => t.coverage === "ALL");
    for (const t of all) {
      expect(translationCovers(t, "OT")).toBe(true);
      expect(translationCovers(t, "NT")).toBe(true);
      expect(translationsFor("OT").map((x) => x.id)).toContain(t.id);
      expect(translationsFor("NT").map((x) => x.id)).toContain(t.id);
    }
  });
});
