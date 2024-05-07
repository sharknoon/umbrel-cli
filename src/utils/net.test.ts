import { describe, it, expect } from "vitest";
import { isValidUrl } from "./net";

describe("isValidUrl", () => {
  it("should return true for a valid URL", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://localhost:3000")).toBe(true);
    expect(isValidUrl("ftp://ftp.example.com")).toBe(true);
    expect(isValidUrl("mailto:user@example.com")).toBe(true);
  });

  it("should return false for an invalid URL", () => {
    expect(isValidUrl("example.com")).toBe(false);
    expect(isValidUrl("httpexample.com")).toBe(false);
    expect(isValidUrl("://example.com")).toBe(false);
    expect(isValidUrl("user@example.com")).toBe(false);
  });
});
