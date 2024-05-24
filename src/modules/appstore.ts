import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import umbrelAppStoreYmlSchema from "../schemas/appstore/umbrel-app-store.yml.schema";
import { exists } from "../utils/fs";
import { officialAppStoreDir } from "./paths";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node/index.js";

const appStoreTypeCache = new Map<
  string,
  "official" | "community" | undefined
>();
export async function getAppStoreType(
  cwd: string
): Promise<"official" | "community" | undefined> {
  if (appStoreTypeCache.has(cwd)) {
    return appStoreTypeCache.get(cwd);
  }

  if (await exists(path.join(cwd, "umbrel-app-store.yml"))) {
    appStoreTypeCache.set(cwd, "community");
    return "community";
  }

  const officialAppStoreAppIds = await getAppIds(officialAppStoreDir);
  const appIds = await getAppIds(cwd);
  // check if dir contains at least all the apps from the official app store
  if (officialAppStoreAppIds.every((oid) => appIds.some((id) => id === oid))) {
    appStoreTypeCache.set(cwd, "official");
    return "official";
  }

  appStoreTypeCache.set(cwd, undefined);
  return undefined;
}

export async function getAppIds(cwd: string): Promise<string[]> {
  const appIds = await fs.readdir(cwd, { withFileTypes: true });
  return appIds
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);
}

export async function isAppStoreDirectory(cwd: string) {
  const appStoreType = await getAppStoreType(cwd);
  return appStoreType !== undefined;
}

const umbrelAppStoreYmlCache = new Map();
export async function getUmbrelAppStoreYml(cwd: string) {
  const file = path.join(cwd, "umbrel-app-store.yml");
  if (umbrelAppStoreYmlCache.has(file)) {
    return umbrelAppStoreYmlCache.get(file);
  }
  if (!(await exists(file))) {
    return undefined;
  }
  const schema = await umbrelAppStoreYmlSchema(cwd);
  const data = await schema.safeParseAsync(
    YAML.parse(await fs.readFile(file, "utf-8"))
  );
  umbrelAppStoreYmlCache.set(file, data.data);
  return data.data;
}

export async function cloneUmbrelAppsRepository(dir: string) {
  await fs.mkdir(dir, { recursive: true });
  await git.clone({
    fs,
    http,
    dir,
    url: "https://github.com/getumbrel/umbrel-apps.git",
    depth: 1,
    singleBranch: true,
  });
}