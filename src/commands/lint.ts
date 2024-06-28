import fs from "node:fs/promises";
import YAML from "yaml";
import { exists } from "../utils/fs";
import umbrelAppStoreYmlSchema from "../schemas/umbrel-app-store.yml.schema";
import path from "node:path";
import pc from "picocolors";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { getAllAppIds, getAppStoreType } from "../modules/appstore";
import { getUmbrelAppYmls } from "../modules/apps";
import umbrelAppYmlSchema from "../schemas/umbrel-app.yml.schema";
import dockerComposeYmlSchema from "../schemas/docker-compose.yml.schema.json";
import { mockVariables } from "../modules/mock";
import { ComposeSpecification } from "../schemas/docker-compose.yml.schema";

export async function lint(cwd: string): Promise<number> {
  let noLintingErrors = true;
  noLintingErrors = (await lintUmbrelAppStoreYml(cwd)) && noLintingErrors;
  noLintingErrors = (await lintReadmeMd(cwd)) && noLintingErrors;
  for (const id of await getAllAppIds(cwd)) {
    noLintingErrors = (await lintUmbrelAppYml(cwd, id)) && noLintingErrors;
    noLintingErrors = (await lintDockerComposeYml(cwd, id)) && noLintingErrors;
  }
  noLintingErrors =
    (await lintUmbrelAppYmlDuplications(cwd)) && noLintingErrors;
  console.log(
    noLintingErrors
      ? pc.green("No linting errors found 🎉")
      : pc.red("Linting failed.")
  );
  return noLintingErrors ? 0 : 1;
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

  // Check if the taglines do not end with a period (except for those with multiple periods in it)
  if (
    result.data.tagline.endsWith(".") &&
    result.data.tagline.split(".").length === 2
  ) {
    printLintingError(
      "Taglines should not end with a period",
      result.data.tagline.split(".")[0] + pc.bold(pc.cyan("."))
    );
    return false;
  }
  return true;
}

async function lintUmbrelAppYmlDuplications(cwd: string): Promise<boolean> {
  let noLintingErrors = true;
  const appYmls = await getUmbrelAppYmls(cwd);
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
  return noLintingErrors;
}

async function lintDockerComposeYml(cwd: string, id: string): Promise<boolean> {
  console.log(`Checking ${path.join(id, "docker-compose.yml")}`);

  let result = true;

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
  let dockerComposeYmlMocked: ComposeSpecification;
  try {
    dockerComposeYmlMocked = YAML.parse(rawDockerComposeYmlMocked, {
      merge: true,
    });
  } catch (e) {
    printLintingError("docker-compose.yml is not a valid YAML file", String(e));
    return false;
  }

  // Check if the file is a valid docker compose file
  const ajv = new Ajv({ allowUnionTypes: true });
  addFormats(ajv);
  const validate = ajv.compile<ComposeSpecification>(dockerComposeYmlSchema);
  const validAppYaml = validate(dockerComposeYmlMocked);
  if (!validAppYaml) {
    for (const err of validate.errors ?? []) {
      printLintingError(err.instancePath, err.message ?? "Unknown error");
    }
    return false;
  }

  // Check if empty folders with .gitkeep exist for every volume
  // This doesn't work properly (no easy way to detect, if a volume mount is a file or a directory)
  /*
  const dockerComposeYml: ComposeSpecification = YAML.parse(
    rawDockerComposeYml,
    { merge: true }
  );
  const hostVolumeMounts = Object.keys(dockerComposeYml.services ?? {}).flatMap(
    (service) => dockerComposeYml.services?.[service].volumes ?? []
  );
  const appDataPaths = new Set<string>();
  for (const volume of hostVolumeMounts) {
    if (typeof volume !== "string") {
      continue;
    }
    const volumeMatch = volume.match(/^\$\{?APP_DATA_DIR\}?(.+?):.*$/);
    if (!volumeMatch || !volumeMatch[1]) {
      continue;
    }
    let appDataPath = path.normalize(volumeMatch[1]);
    //process.stdout.write(appDataPath);
    // In case the path is a file, remove the last path segment
    if (appDataPath.split(path.sep).pop()?.includes(".") ?? false) {
      appDataPath = path.dirname(appDataPath);
    }
    // If there is no directory left, skip
    if (appDataPath === path.sep || appDataPath === ".") {
      continue;
    }
    //console.log(" => " + appDataPath)
    appDataPath = path.join(id, appDataPath);
    appDataPaths.add(appDataPath);
  }
  for (const appDataPath of appDataPaths) {
    if (!(await exists(path.join(cwd, appDataPath, ".gitkeep")))) {
      printLintingError(
        `Missing directory ${pc.cyan(appDataPath)} with ${pc.cyan(".gitkeep")}`,
        `To ensure that the directory have the right permissions, create the directory and add a .gitkeep file in it to keep it in the git repository`
      );
    }
  }
  */

  // Check if the image follows the naming convention
  const services = Object.keys(dockerComposeYmlMocked.services ?? {});
  for (const service of services) {
    const image = dockerComposeYmlMocked.services?.[service].image;
    if (!image) {
      continue;
    }
    const imageMatch = image.match(/^(.+):(.+)@(.+)$/);
    if (!imageMatch) {
      printLintingError(
        `Invalid image name ${pc.cyan(image)}`,
        `Images should be named like ${pc.cyan("<name>:<version>@<sha256>")}`
      );
      result = false;
    } else {
      const [, version] = imageMatch.slice(1);
      if (version === "latest") {
        printLintingError(
          `Invalid image tag ${pc.cyan(version)}`,
          `Images should not use the "latest" tag`,
          "warning"
        );
      }
    }
  }

  return result;
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
