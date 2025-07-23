import path from "node:path";
import fs from "node:fs/promises";
import YAML from "yaml";
import umbrelAppYmlSchema from "../schemas/umbrel-app.yml.schema";
import { isAppStoreDirectory } from "./appstore";

export async function getValidatedUmbrelAppYmls(cwd: string) {
  const rawUmbrelAppYmls = await getUmbrelAppYmls(cwd);
  const umbrelAppYmls = [];
  for (const rawUmbrelAppYml of rawUmbrelAppYmls) {
    const schema = await umbrelAppYmlSchema();
    const result = await schema.safeParseAsync(YAML.parse(rawUmbrelAppYml));
    if (result.success) {
      umbrelAppYmls.push(result.data);
    }
  }
  return umbrelAppYmls;
}

export async function getUmbrelAppYmls(cwd: string): Promise<string[]> {
  if (!(await isAppStoreDirectory(cwd))) {
    return [];
  }
  const appIds = await fs.readdir(cwd, {
    withFileTypes: true,
    recursive: true,
  });
  const rawUmbrelAppYmls: string[] = [];
  for (const appId of appIds) {
    if (appId.name !== "umbrel-app.yml") {
      continue;
    }
    const file = path.resolve(appId.parentPath, appId.name);
    const yml = await fs.readFile(file, "utf-8");
    rawUmbrelAppYmls.push(yml);
  }
  return rawUmbrelAppYmls;
}
