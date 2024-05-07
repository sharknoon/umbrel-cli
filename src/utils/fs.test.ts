import { describe, it, expect } from "vitest";
import { exists } from "./fs";

describe("exists", () => {
  it("should return true for an existing path", async () => {
    const result = await exists("./README.md");
    expect(result).toBe(true);
  });

  it("should return false for a non-existing path", async () => {
    const result = await exists("/path/to/non-existing/file.txt");
    expect(result).toBe(false);
  });
});