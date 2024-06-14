import { describe, it, expect } from "vitest";
import { analyzeRegistry } from "./registry";

describe("isRegistry", () => {
  it("should return true for a valid registry host", async () => {
    const result = await analyzeRegistry("registry.hub.docker.com");
    expect(result).toBe(true);
  });

  it("should return true for another valid registry host", async () => {
    const result = await analyzeRegistry("ghcr.io");
    expect(result).toBe(true);
  });

  it("should return true for yet another valid registry host", async () => {
    const result = await analyzeRegistry("quay.io");
    expect(result).toBe(true);
  });

  it("should return false for an invalid registry host", async () => {
    const result = await analyzeRegistry("invalid.registry.com");
    expect(result).toBe(false);
  });
});
