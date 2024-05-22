import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node/index.js";

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

console.log("Pulling the official Umbrel App Store from GitHub");
await fs.mkdir(officialAppStoreDir, { recursive: true });
await git.clone({
  fs,
  http,
  dir: officialAppStoreDir,
  url: "https://github.com/getumbrel/umbrel-apps.git",
  depth: 1,
  singleBranch: true,
});
