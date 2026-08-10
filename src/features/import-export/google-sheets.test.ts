import { describe, expect, it } from "vitest";
import {
  buildGoogleSheetExportUrl,
  parseGoogleSheetUrl,
} from "./google-sheets";

describe("parseGoogleSheetUrl", () => {
  it("parses edit URL with gid in hash", () => {
    const parsed = parseGoogleSheetUrl(
      "https://docs.google.com/spreadsheets/d/1AbCdefGhIjKlMnOpQrStUvWxYz1234567890abc/edit#gid=12345",
    );
    expect(parsed.spreadsheetId).toBe(
      "1AbCdefGhIjKlMnOpQrStUvWxYz1234567890abc",
    );
    expect(parsed.gid).toBe("12345");
  });

  it("parses edit URL with gid in query", () => {
    const parsed = parseGoogleSheetUrl(
      "https://docs.google.com/spreadsheets/d/1AbCdefGhIjKlMnOpQrStUvWxYz1234567890abc/edit?gid=99#gid=99",
    );
    expect(parsed.gid).toBe("99");
  });

  it("accepts bare spreadsheet id", () => {
    const parsed = parseGoogleSheetUrl(
      "1AbCdefGhIjKlMnOpQrStUvWxYz1234567890abc",
    );
    expect(parsed.spreadsheetId).toBe(
      "1AbCdefGhIjKlMnOpQrStUvWxYz1234567890abc",
    );
    expect(parsed.gid).toBeNull();
  });

  it("rejects non-Google hosts", () => {
    expect(() =>
      parseGoogleSheetUrl("https://evil.example/spreadsheets/d/abc123"),
    ).toThrow(/docs\.google\.com/);
  });

  it("builds xlsx export URL", () => {
    const url = buildGoogleSheetExportUrl({
      spreadsheetId: "1AbCdefGhIjKlMnOpQrStUvWxYz1234567890abc",
      gid: "7",
    });
    expect(url).toContain("/export?");
    expect(url).toContain("format=xlsx");
    expect(url).toContain("gid=7");
  });
});
