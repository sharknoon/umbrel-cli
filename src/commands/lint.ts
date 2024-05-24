import fs from "node:fs/promises";
import YAML from "yaml";
import { exists } from "../utils/fs";
import umbrelAppStoreYmlSchema from "../schemas/appstore/umbrel-app-store.yml.schema";
import path from "node:path";
import pc from "picocolors";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { getAppIds, getAppStoreType } from "../modules/appstore";
import { getRawUmbrelAppYmls } from "../modules/apps";
import umbrelAppYmlSchema from "../schemas/app/umbrel-app.yml.schema";
import dockerComposeYmlSchema from "../schemas/app/docker-compose.yml.schema.json";
import { mockVariables } from "../modules/shell";

export async function lint(cwd: string) {
  let noLintingErrors = true;
  noLintingErrors = (await lintUmbrelAppStoreYml(cwd)) && noLintingErrors;
  noLintingErrors = (await lintReadmeMd(cwd)) && noLintingErrors;
  for (const id of await getAppIds(cwd)) {
    noLintingErrors = (await lintUmbrelAppYml(cwd, id)) && noLintingErrors;
    noLintingErrors = (await lintDockerComposeYml(cwd, id)) && noLintingErrors;
    // TODO exportsSh(id)
  }
  lintUmbrelAppYmlDuplications(cwd);
  console.log(
    noLintingErrors
      ? pc.green("No linting errors found 🎉")
      : pc.red("Linting failed.")
  );
}

async function lintUmbrelAppStoreYml(cwd: string): Promise<boolean> {
  if ((await getAppStoreType(cwd)) === "official") {
    return true;
  }
  console.log("Checking umbrel-app-store.yml");

  // Check if the file exists
  const umbrelAppStoreYmlPath = path.resolve(cwd, "umbrel-app-store.yml");
  if (!(await exists(umbrelAppStoreYmlPath))) {
    printLintingError(
      "umbrel-app-store.yml does not exist",
      "For community app stores, the file umbrel-app-store.yml is required"
    );
    return false;
  }

  // check if the file is valid yaml
  let umbrelAppStoreYml;
  try {
    umbrelAppStoreYml = YAML.parse(
      await fs.readFile(umbrelAppStoreYmlPath, "utf-8")
    );
  } catch (e) {
    printLintingError(
      "umbrel-app-store.yml is not a valid YAML file",
      String(e)
    );
    return false;
  }

  // zod parse the file
  const schema = await umbrelAppStoreYmlSchema(cwd);
  const result = await schema.safeParseAsync(umbrelAppStoreYml);
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      printLintingError(issue.path.join("."), issue.message);
    });
    return false;
  }
  return true;
}

async function lintReadmeMd(cwd: string): Promise<boolean> {
  console.log("Checking README.md");
  const readmeMdPath = path.resolve(cwd, "README.md");
  if (!(await exists(readmeMdPath))) {
    printLintingError(
      "README.md does not exist",
      "A README.md file is highly recommended to tell users, how to install your App Store and what apps are available",
      "warning"
    );
    return false;
  }
  // TODO more linting
  return true;
}

async function lintUmbrelAppYml(cwd: string, id: string): Promise<boolean> {
  console.log(`Checking ${path.join(id, "umbrel-app.yml")}`);
  const umbrelAppYmlPath = path.resolve(cwd, id, "umbrel-app.yml");
  // Check if the file exists
  if (!(await exists(umbrelAppYmlPath))) {
    printLintingError(
      "umbrel-app.yml does not exist",
      `Every app needs a manifest file called "umbrel-app.yml" at the root of the app directory`
    );
    return false;
  }

  // check if the file is valid yaml
  let umbrelAppYml;
  try {
    umbrelAppYml = YAML.parse(await fs.readFile(umbrelAppYmlPath, "utf-8"));
  } catch (e) {
    printLintingError("umbrel-app.yml is not a valid YAML file", String(e));
    return false;
  }

  // zod parse the file
  const schema = await umbrelAppYmlSchema(cwd);
  const result = await schema.safeParseAsync(umbrelAppYml);
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      printLintingError(issue.path.join("."), issue.message);
    });
    return false;
  }
  return true;
}

async function lintUmbrelAppYmlDuplications(cwd: string): Promise<boolean> {
  let noLintingErrors = true;
  const appYmls = await getRawUmbrelAppYmls(cwd);
  // Check if a port is used by multiple apps
  const ports = new Map<number, string>();
  for (const appYml of appYmls) {
    if (typeof appYml !== "object" || appYml === null) {
      continue;
    }
    if (!("port" in appYml) || typeof appYml.port !== "number") {
      continue;
    }
    if (!("name" in appYml) || typeof appYml.name !== "string") {
      continue;
    }
    if (ports.has(appYml.port)) {
      noLintingErrors = false;
      const existintAppName = ports.get(appYml.port);
      printLintingError(
        `Port ${appYml.port} is already used by ${existintAppName}`,
        `Each app must use a unique port`
      );
    }
    ports.set(appYml.port, appYml.name);
  }
  return !noLintingErrors;
}

async function lintDockerComposeYml(cwd: string, id: string): Promise<boolean> {
  console.log(`Checking ${path.join(id, "docker-compose.yml")}`);
  const dockerComposeYmlPath = path.resolve(cwd, id, "docker-compose.yml");
  // Check if the file exists
  if (!(await exists(dockerComposeYmlPath))) {
    printLintingError(
      "docker-compose.yml does not exist",
      `Every app needs a docker compose file called "docker-compose.yml" at the root of the app directory`
    );
    return false;
  }

  // Read the file and mock the variables
  const rawDockerComposeYml = await fs.readFile(dockerComposeYmlPath, "utf-8");
  const rawDockerComposeYmlMocked = await mockVariables(rawDockerComposeYml);

  // check if the file is valid yaml
  let dockerComposeYml;
  try {
    dockerComposeYml = YAML.parse(rawDockerComposeYmlMocked, { merge: true });
  } catch (e) {
    printLintingError("docker-compose.yml is not a valid YAML file", String(e));
    return false;
  }

  // Check if the file is a valid docker compose file
  const ajv = new Ajv({ allowUnionTypes: true });
  addFormats(ajv);
  const validate = ajv.compile(dockerComposeYmlSchema);
  const validAppYaml = validate(dockerComposeYml);
  if (!validAppYaml) {
    for (const err of validate.errors ?? []) {
      printLintingError(err.instancePath, err.message ?? "Unknown error");
    }
    return false;
  }

  // Check if empty folders with .gitkeep exist for every volume

  return true;
}

function printLintingError(
  title: string,
  message: string,
  severity: "error" | "warning" = "error"
) {
  const level =
    severity === "error"
      ? pc.bgRed(pc.bold(" ERROR "))
      : pc.bgYellow(pc.bold(" WARNING "));
  console.log(`${level} ${pc.bold(title)}: ${pc.italic(pc.gray(message))}`);
}
