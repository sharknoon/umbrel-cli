import { describe, it, expect } from "vitest";
import { getUmbrelAppYmls } from "./apps";

describe("getUmbrelAppYmls", () => {
  it("should return an array of UmbrelApp objects when 'umbrel-app.yml' files exist in the directory", async () => {
    const dir = "tests/umbrel-apps";
    const result = await getUmbrelAppYmls(dir);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("version");
  });

  it("should return an empty array when no 'umbrel-app.yml' files exist in the directory", async () => {
    const dir = ".";
    const result = await getUmbrelAppYmls(dir);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});