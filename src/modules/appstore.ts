import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import umbrelAppStoreYmlSchema from "../schemas/umbrel-app-store.yml.schema";
import { exists } from "../utils/fs";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

const appStoreTypeCache = new Map<
  string,
  "official" | "community" | undefined
>();
export async function getAppStoreType(
  cwd: string,
): Promise<"official" | "community" | undefined> {
  if (appStoreTypeCache.has(cwd)) {
    return appStoreTypeCache.get(cwd);
  }

  if (!(await isAppStoreDirectory(cwd))) {
    appStoreTypeCache.set(cwd, undefined);
    return undefined;
  }

  if (await exists(path.join(cwd, "umbrel-app-store.yml"))) {
    appStoreTypeCache.set(cwd, "community");
    return "community";
  }

  appStoreTypeCache.set(cwd, "official");
  return "official";
}

export async function getAllAppIds(cwd: string): Promise<string[]> {
  const appIds = await fs.readdir(cwd, { withFileTypes: true });
  return appIds
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);
}

export async function isAppStoreDirectory(cwd: string) {
  if (!(await exists(cwd))) {
    return false;
  }

  if (await exists(path.join(cwd, "umbrel-app-store.yml"))) {
    return true;
  }

  const entries = await fs.readdir(cwd, {
    withFileTypes: true,
    recursive: true,
  });
  for (const entry of entries) {
    if (entry.name !== "umbrel-app.yml") {
      continue;
    }
    // Check if the depth of the file is 1
    const difference = path.relative(cwd, entry.parentPath);
    return difference.split(path.sep).length === 1;
  }
  return false;
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
  const schema = await umbrelAppStoreYmlSchema();
  const data = await schema.safeParseAsync(
    YAML.parse(await fs.readFile(file, "utf-8")),
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
