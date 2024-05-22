import { spinner } from "@clack/prompts";
import fs from "node:fs/promises";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node/index.js";
import { officialAppStoreDir } from "./paths";

export async function init() {
  await cloneOfficialAppStore(officialAppStoreDir);
}

export async function cloneOfficialAppStore(dir: string) {
  const s = spinner();
  s.start("Pulling the official Umbrel App Store from GitHub");
  await fs.mkdir(dir, { recursive: true });
  await git.clone({
    fs,
    http,
    dir,
    url: "https://github.com/getumbrel/umbrel-apps.git",
    depth: 1,
    singleBranch: true,
  });
  s.stop("Finished pulling the official Umbrel App Store");
}
