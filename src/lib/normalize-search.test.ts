import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearch } from "./normalize-search";

describe("normalizeSearch", () => {
  it("strips Vietnamese diacritics", () => {
    expect(normalizeSearch("Nguyễn Việt")).toBe("nguyen viet");
    expect(normalizeSearch("viet")).toBe("viet");
  });
});

describe("matchesSearch", () => {
  it("matches without accents", () => {
    expect(matchesSearch("Nguyễn Việt Anh", "viet")).toBe(true);
    expect(matchesSearch("Trần Đình", "dinh")).toBe(true);
    expect(matchesSearch("Lê Thị", "le thi")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesSearch("HOÀNG", "hoang")).toBe(true);
  });

  it("rejects non-matches", () => {
    expect(matchesSearch("Nguyễn Việt", "tran")).toBe(false);
  });
});
