import { describe, it, expect, afterAll } from "vitest";
import { cloneOfficialAppStore } from "./init";
import { promises as fs } from "fs";

describe("cloneOfficialAppStore", () => {
  it("should clone the official Umbrel App Store from GitHub", async () => {
    const dir = "tests/umbrel-apps-temporary";
    await cloneOfficialAppStore(dir);
    const files = await fs.readdir(dir);
    expect(files.length).toBeGreaterThan(50);
  });
});

afterAll(async () => {
  await fs.rm("tests/umbrel-apps-temporary", { recursive: true });
});