import path from "node:path";
import os from "node:os";
import { expect, describe, it } from "vitest";
import { officialAppStoreDir, umbrelCliDir } from "./paths";
import { exists } from "../utils/fs";
import { getAppStoreType } from "./appstore";

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

  it("should have cloned the official Umbrel App Store from GitHub", async () => {
    expect(await exists(officialAppStoreDir)).toBe(true);
    expect(await getAppStoreType(officialAppStoreDir)).toBe("official");
  });
});
