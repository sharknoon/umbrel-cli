import path from "node:path";
import fs from "node:fs/promises";
import YAML from "yaml";
import umbrelAppYmlSchema from "../schemas/umbrel-app.yml.schema";
import { isAppStoreDirectory } from "./appstore";

export async function getUmbrelAppYmls(cwd: string) {
  const rawUmbrelAppYmls = await getRawUmbrelAppYmls(cwd);
  const umbrelAppYmls = [];
  for (const rawUmbrelAppYml of rawUmbrelAppYmls) {
    const schema = await umbrelAppYmlSchema(cwd);
    const result = await schema.safeParseAsync(rawUmbrelAppYml);
    if (result.success) {
      umbrelAppYmls.push(result.data);
    }
  }
  return umbrelAppYmls;
}

export async function getRawUmbrelAppYmls(cwd: string) {
  if (!(await isAppStoreDirectory(cwd))) {
    return [];
  }
  const appIds = await fs.readdir(cwd, {
    withFileTypes: true,
    recursive: true,
  });
  const rawUmbrelAppYmls: unknown[] = [];
  for (const appId of appIds) {
    if (appId.name !== "umbrel-app.yml") {
      continue;
    }
    const file = path.resolve(appId.path, appId.name);
    const yml = YAML.parse(await fs.readFile(file, "utf-8"));
    rawUmbrelAppYmls.push(yml);
  }
  return rawUmbrelAppYmls;
}
