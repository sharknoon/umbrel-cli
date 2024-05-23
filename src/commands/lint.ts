import fs from "node:fs/promises";
import YAML from "yaml";
import { exists } from "../utils/fs";
import umbrelAppStoreYmlSchema from "../schemas/appstore/umbrel-app-store.yml.schema";
import path from "node:path";
import pc from "picocolors";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { getAppIds, getAppStoreType } from "../modules/appstore";
import { getUmbrelAppYmls } from "../modules/apps";
import umbrelAppYmlSchema from "../schemas/app/umbrel-app.yml.schema";
import dockerComposeYmlSchema from "../schemas/app/docker-compose.yml.schema.json";

export async function lint() {
  let noLintingErrors = true;
  noLintingErrors = (await lintUmbrelAppStoreYml()) && noLintingErrors;
  noLintingErrors = (await lintReadmeMd()) && noLintingErrors;
  for (const id of await getAppIds()) {
    noLintingErrors = (await lintUmbrelAppYml(id)) && noLintingErrors;
    noLintingErrors = (await lintDockerComposeYml(id)) && noLintingErrors;
    // TODO exportsSh(id)
  }
  lintUmbrelAppYmlDuplications();
  console.log(
    noLintingErrors
      ? pc.green("No linting errors found 🎉")
      : pc.red("Linting failed.")
  );
}

async function lintUmbrelAppStoreYml(): Promise<boolean> {
  if ((await getAppStoreType()) === "official") {
    return true;
  }
  console.log("Checking umbrel-app-store.yml");

  // Check if the file exists
  if (!(await exists("umbrel-app-store.yml"))) {
    printLintingError(
      "umbrel-app-store.yml does not exist.",
      "For community app stores, the file umbrel-app-store.yml is required."
    );
    return false;
  }

  // check if the file is valid yaml
  let umbrelAppStoreYml;
  try {
    umbrelAppStoreYml = YAML.parse(
      await fs.readFile("umbrel-app-store.yml", "utf-8")
    );
  } catch (e) {
    printLintingError(
      "umbrel-app-store.yml is not a valid YAML file.",
      String(e)
    );
    return false;
  }

  // zod parse the file
  const result = await umbrelAppStoreYmlSchema.safeParseAsync(
    umbrelAppStoreYml
  );
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      printLintingError(issue.path.join("."), issue.message);
    });
    return false;
  }
  return true;
}

async function lintReadmeMd(): Promise<boolean> {
  console.log("Checking README.md");
  if (!(await exists("README.md"))) {
    printLintingError(
      "README.md does not exist.",
      "A README.md file is highly recommended to tell users, how to install your App Store and what apps are available.",
      "warning"
    );
    return false;
  }
  return true;
}

async function lintUmbrelAppYml(id: string): Promise<boolean> {
  const umbrelAppYmlPath = path.resolve(id, "umbrel-app.yml");
  console.log(`Checking ${path.join(id, "umbrel-app.yml")}`);
  // Check if the file exists
  if (!(await exists(umbrelAppYmlPath))) {
    printLintingError(
      "umbrel-app.yml does not exist.",
      `Every app needs a manifest file called "umbrel-app.yml" at the root of the app directory.`
    );
    return false;
  }

  // check if the file is valid yaml
  let umbrelAppYml;
  try {
    umbrelAppYml = YAML.parse(await fs.readFile(umbrelAppYmlPath, "utf-8"));
  } catch (e) {
    printLintingError("umbrel-app.yml is not a valid YAML file.", String(e));
    return false;
  }

  // zod parse the file
  const result = await umbrelAppYmlSchema.safeParseAsync(umbrelAppYml);
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      printLintingError(issue.path.join("."), issue.message);
    });
    return false;
  }
  return true;
}

async function lintUmbrelAppYmlDuplications(): Promise<boolean> {
  let noLintingErrors = true;
  const appYmls = await getUmbrelAppYmls({ onlyValid: false });
  // Check if a port is used by multiple apps
  const ports = new Map<number, string>();
  for (const appYml of appYmls) {
    if (ports.has(appYml.port)) {
      noLintingErrors = false;
      const existintAppName = ports.get(appYml.port);
      printLintingError(
        `Port ${appYml.port} is already used by ${existintAppName}.`,
        `Each app must use a unique port.`
      );
    }
    ports.set(appYml.port, appYml.name);
  }
  return !noLintingErrors;
}

async function lintDockerComposeYml(id: string): Promise<boolean> {
  const dockerComposeYmlPath = path.resolve(id, "docker-compose.yml");
  console.log(`Checking ${path.join(id, "docker-compose.yml")}`);
  // Check if the file exists
  if (!(await exists(dockerComposeYmlPath))) {
    printLintingError(
      "docker-compose.yml does not exist.",
      `Every app needs a docker compose file called "docker-compose.yml" at the root of the app directory.`
    );
    return false;
  }

  // check if the file is valid yaml
  let dockerComposeYml;
  try {
    dockerComposeYml = YAML.parse(await fs.readFile(dockerComposeYmlPath, "utf-8"));
  } catch (e) {
    printLintingError("docker-compose.yml is not a valid YAML file.", String(e));
    return false;
  }

  // Check if the file is a valid docker compose file
  const ajv = new Ajv({allowUnionTypes: true});
  addFormats(ajv);
  const validate = ajv.compile(dockerComposeYmlSchema);
  const validAppYaml = validate(dockerComposeYml);
  if (!validAppYaml) {
    for (const err of validate.errors ?? []) {
      printLintingError(err.instancePath, err.message ?? "Unknown error.")
    }
    return false;
  }
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
