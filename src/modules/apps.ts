import path from "node:path";
import fs from "node:fs/promises";
import YAML from "yaml";
import umbrelAppYmlSchema, {
  UmbrelApp,
} from "../schemas/app/umbrel-app.yml.schema";
import { isAppStoreDirectory } from "./appstore";

const umbrelAppYmlsCache = new Map<string, UmbrelApp[]>();
const potentiallyInvalidUmbrelAppYmlsCache = new Map<string, UmbrelApp[]>();
export async function getUmbrelAppYmls(
  options: { dir?: string; onlyValid?: boolean } = {}
): Promise<UmbrelApp[]> {
  let { dir, onlyValid } = options;
  dir = path.resolve(dir ?? "");
  onlyValid = onlyValid ?? false;
  if (onlyValid && umbrelAppYmlsCache.has(dir)) {
    return umbrelAppYmlsCache.get(dir) ?? [];
  } else if (!onlyValid && potentiallyInvalidUmbrelAppYmlsCache.has(dir)) {
    return potentiallyInvalidUmbrelAppYmlsCache.get(dir) ?? [];
  }

  if (!(await isAppStoreDirectory(dir))) {
    return [];
  }
  const appIds = await fs.readdir(dir, {
    withFileTypes: true,
    recursive: true,
  });
  const umbrelAppYmls: UmbrelApp[] = [];
  const potentiallyInvalidUmbrelAppYmls: UmbrelApp[] = [];
  for (const appId of appIds) {
    if (appId.name !== "umbrel-app.yml") {
      continue;
    }
    const file = path.resolve(appId.path, appId.name);
    const yml = YAML.parse(await fs.readFile(file, "utf-8"));
    potentiallyInvalidUmbrelAppYmls.push(yml);
    if (onlyValid) {
      const result = await umbrelAppYmlSchema.safeParseAsync(yml);
      if (result.success) {
        umbrelAppYmls.push(result.data);
      }
    }
  }
  umbrelAppYmlsCache.set(dir, umbrelAppYmls);
  potentiallyInvalidUmbrelAppYmlsCache.set(
    dir,
    potentiallyInvalidUmbrelAppYmls
  );
  return onlyValid ? umbrelAppYmls : potentiallyInvalidUmbrelAppYmls;
}
