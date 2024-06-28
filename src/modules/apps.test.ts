import { describe, it, expect } from "vitest";
import { getUmbrelAppYmls, getValidatedUmbrelAppYmls } from "./apps";

describe("getValidatedUmbrelAppYmls", () => {
  it("should return an array of UmbrelApp objects when 'umbrel-app.yml' files exist in the directory", async () => {
    const cwd = "tests/umbrel-apps";
    const result = await getValidatedUmbrelAppYmls(cwd);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("version");
  });

  it("should return an empty array when no 'umbrel-app.yml' files exist in the directory", async () => {
    const cwd = ".";
    const result = await getValidatedUmbrelAppYmls(cwd);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

describe("getUmbrelAppYmls", () => {
  it("should return an array of parsed 'umbrel-app.yml' files when 'umbrel-app.yml' files exist in the directory", async () => {
    const cwd = "tests/umbrel-apps";
    const result = await getUmbrelAppYmls(cwd);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("version");
  });

  it("should return an empty array when no 'umbrel-app.yml' files exist in the directory", async () => {
    const cwd = ".";
    const result = await getUmbrelAppYmls(cwd);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});