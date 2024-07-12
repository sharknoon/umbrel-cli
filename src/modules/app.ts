import path from "node:path";
import fs from "node:fs/promises";
import YAML from "yaml";
import { isAppStoreDirectory } from "./appstore";
import umbrelAppYmlSchema from "../schemas/umbrel-app.yml.schema";

export async function getValidatedUmbrelAppYml(cwd: string, appId: string) {
  const rawUmbrelAppYml = await getUmbrelAppYml(cwd, appId);
  const schema = await umbrelAppYmlSchema();
  return await schema.safeParseAsync(rawUmbrelAppYml);
}

export async function getUmbrelAppYml(cwd: string, appId: string) {
  if (!(await isAppStoreDirectory(cwd))) {
    return;
  }
  const file = path.resolve(cwd, appId, "umbrel-app.yml");
  return YAML.parse(await fs.readFile(file, "utf-8"));
}
