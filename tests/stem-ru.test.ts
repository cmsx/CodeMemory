import { describe, expect, it } from "vitest";
import { stemRussian } from "../src/core/stem-ru.js";

describe("stemRussian", () => {
  // Snowball can over-strip, so a lemma's forms need not all reach an
  // identical stem. What search relies on: the shortest stem in a family is a
  // prefix of every form, so `shortestStem*` recalls them all.
  it("yields a family stem that prefixes every inflected form", () => {
    const families = [
      ["отмена", "отмену", "отмены", "отмене", "отменой"],
      ["заказ", "заказа", "заказу", "заказом", "заказы", "заказами"],
      ["освобождать", "освобождает", "освобождают", "освобождала"],
      ["резерв", "резерва", "резервы", "резервом"],
    ];
    for (const family of families) {
      const shortest = family
        .map(stemRussian)
        .reduce((a, b) => (a.length <= b.length ? a : b));
      for (const form of family) {
        expect(form.startsWith(shortest), `${form} / ${shortest}`).toBe(true);
      }
    }
  });

  it("produces a stem that is a prefix of every inflected form", () => {
    for (const w of ["отмену", "заказами", "освобождает", "цитированием"]) {
      expect(w.startsWith(stemRussian(w)), w).toBe(true);
    }
  });

  it("leaves non-Cyrillic input unchanged", () => {
    expect(stemRussian("HybridRetriever")).toBe("HybridRetriever");
    expect(stemRussian("rerank")).toBe("rerank");
    expect(stemRussian("bm25")).toBe("bm25");
  });

  it("does not over-strip short words without a suffix region", () => {
    expect(stemRussian("код")).toBe("код");
    expect(stemRussian("да")).toBe("да");
  });
});
