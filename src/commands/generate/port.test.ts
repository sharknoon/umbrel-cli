import { describe, expect, it } from "vitest";
import { main } from "../../parser";
import { catchStdout } from "../../utils/test";
import { getValidatedUmbrelAppYmls } from "../../modules/apps";
import { officialAppStoreDir } from "../../modules/paths";

describe("umbrel generate port", () => {
  it("should generate a random port not used by any app", async () => {
    const stdout = await catchStdout(async () => {
      await main(["port", "generate"]);
    });

    const officialUmbrelAppYmls =
      await getValidatedUmbrelAppYmls(officialAppStoreDir);
    expect(stdout).toMatch(/\d+/);
    const port = parseInt(stdout, 10);
    expect(officialUmbrelAppYmls.map((app) => app.port)).not.toContain(port);
    expect(port).toBeGreaterThanOrEqual(1024);
    expect(port).toBeLessThanOrEqual(65535);
  });
});
