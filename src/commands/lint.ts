import fs from "node:fs/promises";
import YAML from "yaml";
import {
  getAllAppStoreAppIds,
  isOfficialAppStoreDirectory,
} from "../utils/appstore";
import { exists } from "../utils/fs";
import umbrelAppStoreYmlSchema from "../schemas/appstore/umbrel-app-store.yml.schema";
import umbrelAppYmlSchema from "../schemas/app/umbrel-app.yml.schema";
import path from "node:path";
import pc from "picocolors";

export async function lint() {
  let noLintingErrors = true;
  noLintingErrors &&= await lintUmbrelAppStoreYml();
  noLintingErrors &&= await lintReadmeMd();
  for (let id of await getAllAppStoreAppIds()) {
    noLintingErrors &&= await lintUmbrelAppYml(id);
    // TODO lintDockerComposeYml(id)
    // TODO exportsSh(id)
  }
  console.log(noLintingErrors ? pc.green("No linting errors found 🎉") : pc.red("Linting failed."));
}

async function lintUmbrelAppStoreYml(): Promise<boolean> {
  if (await isOfficialAppStoreDirectory()) {
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
  const result = await umbrelAppStoreYmlSchema.safeParseAsync(umbrelAppStoreYml);
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

function printLintingError(
  title: string,
  message: string,
  severity: "error" | "warning" = "error"
) {
  const level =
    severity === "error" ? pc.bgRed(" ERROR ") : pc.bgYellow(" WARNING ");
  console.log(`${level} ${pc.bold(title)}: ${pc.italic(pc.gray(message))}`);
}
