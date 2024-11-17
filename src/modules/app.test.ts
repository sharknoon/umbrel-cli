import { describe, it, expect } from "vitest";
import { getUmbrelAppYml, getValidatedUmbrelAppYml } from "./app";

describe("getValidatedUmbrelAppYml", () => {
  it("should return the parsed YAML content when the app store directory exists and the YAML is valid", async () => {
    const cwd = "tests/umbrel-apps";
    const appId = "bitcoin";

    const result = await getValidatedUmbrelAppYml(cwd, appId);

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("id", "bitcoin");
    expect(result.data).toHaveProperty("name", "Bitcoin Node");
    expect(result.data).toHaveProperty("submitter", "Umbrel");
  });

  it("should throw an error when the app store directory exists but the YAML is invalid", async () => {
    const cwd = "tests/umbrel-apps";
    const appId = "invalid-app";

    await expect(
      async () => await getValidatedUmbrelAppYml(cwd, appId),
    ).rejects.toThrowError(/no such file/);
  });
});

describe("getUmbrelAppYml", () => {
  it("should return the parsed YAML content when the app store directory exists", async () => {
    const cwd = "tests/umbrel-apps";
    const appId = "bitcoin";

    const result = await getUmbrelAppYml(cwd, appId);

    expect(result).toHaveProperty("id", "bitcoin");
    expect(result).toHaveProperty("name", "Bitcoin Node");
    expect(result).toHaveProperty("submitter", "Umbrel");
  });

  it("should return undefined when the app store directory does not exist", async () => {
    const cwd = "/path/to/non-existent/directory";
    const appId = "my-app";

    const result = await getUmbrelAppYml(cwd, appId);

    expect(result).toBeUndefined();
  });
});
