import fs from "node:fs/promises";
import path from "node:path";
import { listRemotes } from "isomorphic-git";
import YAML from "yaml";

export async function isAppStoreDirectory(): Promise<boolean> {
  return (
    (await isOfficialAppStoreDirectory()) ||
    (await isCommunityAppStoreDirectory())
  );
}

export async function isOfficialAppStoreDirectory(): Promise<boolean> {
  try {
    const remotes = await listRemotes({ fs, dir: path.resolve() });
    return remotes.some(
      (remote) =>
        remote.url === "https://github.com/getumbrel/umbrel-apps.git" ||
        remote.url === "https://github.com/getumbrel/umbrel-apps"
    );
  } catch (error) {
    return false;
  }
}

export async function isCommunityAppStoreDirectory(): Promise<boolean> {
  try {
    await fs.access("umbrel-app-store.yml");
    return true;
  } catch (error) {
    return false;
  }
}

export async function getAppStoreId(): Promise<string> {
  if (await isOfficialAppStoreDirectory()) {
    return "";
  } else {
    try {
      const appStoreFile = await fs.readFile("umbrel-app-store.yml", "utf-8");
      const appStoreYml = YAML.parse(appStoreFile);
      return appStoreYml.id;
    } catch (error) {
      return "";
    }
  }
}