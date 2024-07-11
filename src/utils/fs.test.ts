import { describe, it, expect } from "vitest";
import { exists, readDirRecursive } from "./fs";

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

describe("readDirRecursive", () => {
  it("should return a list of all files and directories in the directory", async () => {
    const result = await readDirRecursive("tests/umbrel-apps");
    expect(
      result.find((f) => f.path === "bitcoin" && f.type === "directory"),
    ).toBeDefined();
    expect(
      result.find(
        (f) => f.path === "bitcoin/umbrel-app.yml" && f.type === "file",
      ),
    ).toBeDefined();
  });
});
