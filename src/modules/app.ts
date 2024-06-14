import path from "node:path";
import fs from "node:fs/promises";
import YAML from "yaml";
import { isAppStoreDirectory } from "./appstore";

export async function getAppYml(cwd: string, appId: string) {
  if (!(await isAppStoreDirectory(cwd))) {
    return;
  }
  const file = path.resolve(cwd, appId, "umbrel-app.yml");
  return YAML.parse(await fs.readFile(file, "utf-8"));
}
