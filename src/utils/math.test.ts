import { describe, it, expect } from "vitest";
import { getRandomInt } from "./math";

describe("getRandomInt", () => {
  it("should return a random integer between min and max (inclusive)", () => {
    const min = 1;
    const max = 10;
    const result = getRandomInt(min, max);
    expect(result).toBeGreaterThanOrEqual(min);
    expect(result).toBeLessThanOrEqual(max);
    expect(Number.isInteger(result)).toBe(true);
  });

  it("should return min when min and max are the same", () => {
    const min = 5;
    const max = 5;
    const result = getRandomInt(min, max);
    expect(result).toBe(min);
  });

  it("should return min when min is greater than max", () => {
    const min = 10;
    const max = 5;
    const result = getRandomInt(min, max);
    expect(result).toBe(min);
  });
});
