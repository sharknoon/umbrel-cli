import path from "node:path";
import os from "node:os";

/**
 * The data path for the Umbrel CLI.
 */
export const umbrelCliDir = path.resolve(os.homedir(), ".umbrel-cli");

/**
 * The directory path for the centrally cloned official Umbrel app store.
 */
export const officialAppStoreDir =
  process.env.NODE_ENV === "test"
    ? path.resolve("tests/umbrel-apps")
    : path.resolve(umbrelCliDir, "umbrel-apps");
