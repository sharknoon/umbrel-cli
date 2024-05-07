import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import umbrelAppStoreYmlSchema, {
  UmbrelAppStore,
} from "../schemas/appstore/umbrel-app-store.yml.schema";
import { exists } from "../utils/fs";

const appStoreTypeCache = new Map<
  string,
  "official" | "community" | undefined
>();
export async function getAppStoreType(
  dir: string = path.resolve()
): Promise<"official" | "community" | undefined> {
  dir = path.resolve(dir);
  if (appStoreTypeCache.has(dir)) {
    return appStoreTypeCache.get(dir);
  }
  if (await exists(path.join(dir, "umbrel-app-store.yml"))) {
    appStoreTypeCache.set(dir, "community");
    return "community";
  }
  const appIds = await getAppIds(dir);
  if (appIds.length === 0) {
    appStoreTypeCache.set(dir, undefined);
    return undefined;
  }
  if (
    await exists(path.join(appIds[0].path, appIds[0].name, "umbrel-app.yml"))
  ) {
    appStoreTypeCache.set(dir, "official");
    return "official";
  }
  appStoreTypeCache.set(dir, undefined);
  return undefined;
}

export async function getAppIds(dir: string = path.resolve()) {
  const appIds = await fs.readdir(dir, { withFileTypes: true });
  return appIds.filter((e) => e.isDirectory() && !e.name.startsWith("."));
}

export async function isAppStoreDirectory(dir: string = path.resolve()) {
  const appStoreType = await getAppStoreType(dir);
  return appStoreType !== undefined;
}

const umbrelAppStoreYmlCache = new Map<string, UmbrelAppStore | undefined>();
export async function getUmbrelAppStoreYml(
  dir = path.resolve()
) {
  dir = path.resolve(dir);
  const file = path.join(dir, "umbrel-app-store.yml");
  if (umbrelAppStoreYmlCache.has(file)) {
    return umbrelAppStoreYmlCache.get(file);
  }
  if (!(await exists(file))) {
    return undefined;
  }
  const data = await umbrelAppStoreYmlSchema.safeParseAsync(
    YAML.parse(await fs.readFile(file, "utf-8"))
  );
  umbrelAppStoreYmlCache.set(file, data.data);
  return data.data;
}
