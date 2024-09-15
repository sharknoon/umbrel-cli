import fs from "node:fs/promises";
import { clone } from "isomorphic-git";
import http from "isomorphic-git/http/node";

export async function setup() {
  await fs.rm("tests", { recursive: true, force: true });
  await clone({
    fs,
    http,
    url: "https://github.com/getumbrel/umbrel-apps.git",
    dir: "tests/umbrel-apps",
    singleBranch: true,
    depth: 1,
  });
  await clone({
    fs,
    http,
    url: "https://github.com/getumbrel/umbrel-community-app-store.git",
    dir: "tests/umbrel-community-app-store",
    singleBranch: true,
    depth: 1,
  });
  await fs.mkdir("tests/empty-directory", { recursive: true });
}

export async function teardown() {
  await fs.rm("tests", { recursive: true });
}
