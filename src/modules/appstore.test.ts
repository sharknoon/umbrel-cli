import { describe, it, expect } from "vitest";
import {
  getAppStoreType,
  getUmbrelAppStoreYml,
  isAppStoreDirectory,
} from "./appstore";

describe("getAppStoreType", () => {
  it("should return 'community' if 'umbrel-app-store.yml' exists", async () => {
    const dir = "tests/umbrel-community-app-store";
    const result = await getAppStoreType(dir);
    expect(result).toBe("community");
  });

  it("should return 'official' if 'umbrel-app.yml' exists in any subdirectory and no 'umbrel-app-store.yml' exists", async () => {
    const dir = "tests/umbrel-apps";
    const result = await getAppStoreType(dir);
    expect(result).toBe("official");
  });

  it("should return undefined if neither 'umbrel-app-store.yml' nor 'umbrel-app.yml' exists", async () => {
    const dir = "";
    const result = await getAppStoreType(dir);
    expect(result).toBeUndefined();
  });
});

describe("isAppStoreDirectory", () => {
  it("should return true if the directory is an app store directory", async () => {
    const dir1 = "tests/umbrel-community-app-store";
    const result1 = await isAppStoreDirectory(dir1);
    expect(result1).toBe(true);
    const dir2 = "tests/umbrel-apps";
    const result2 = await isAppStoreDirectory(dir2);
    expect(result2).toBe(true);
  });

  it("should return false if the directory is not an app store directory", async () => {
    const dir = ".";
    const result = await isAppStoreDirectory(dir);
    expect(result).toBe(false);
  });
});

describe("getUmbrelAppStoreYml", () => {
  it("should return the parsed UmbrelAppStore object if the file exists", async () => {
    const file = "tests/umbrel-community-app-store";
    const result = await getUmbrelAppStoreYml(file);
    expect(result).toBeDefined();
  });

  it("should return undefined if the file does not exist", async () => {
    const file = "non-existent-file.yml";
    const result = await getUmbrelAppStoreYml(file);
    expect(result).toBeUndefined();
  });
});
