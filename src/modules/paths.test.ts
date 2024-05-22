import path from "node:path";
import os from "node:os";
import { expect, describe, it } from "vitest";
import { officialAppStoreDir, umbrelCliDir } from "./paths";

describe("umbrelCliDir", () => {
  it("should return the correct path", () => {
    const expectedPath = path.resolve(os.homedir(), ".umbrel-cli");
    expect(umbrelCliDir).toBe(expectedPath);
  });
});

describe("officialAppStoreDir", () => {
  it("should return the correct path in test environment", () => {
    process.env.NODE_ENV = "test";
    const expectedPath = path.resolve("tests/umbrel-apps");
    expect(officialAppStoreDir).toBe(expectedPath);
  });
});