import fs from "node:fs/promises";
import { exists, readDirRecursive } from "../utils/fs";
import path from "node:path";
import pc from "picocolors";
import { getAllAppIds, getAppStoreType } from "../modules/appstore";
import { getUmbrelAppYmls } from "../modules/apps";
import {
  Entry,
  lintDirectoryStructure as directoryStructure,
  lintDockerComposeYml,
  lintUmbrelAppStoreYml,
  lintUmbrelAppYml,
} from "../modules/lint";

let logLevel: "error" | "warning" | "info";

export async function lint(
  cwd: string,
  appId?: string,
  loglevel?: "error" | "warning" | "info",
): Promise<number> {
  if (appId && !(await exists(path.resolve(cwd, appId)))) {
    console.log(pc.red(`App with id ${appId} does not exist`));
    return 1;
  }
  // If all apps are being linted, omit the info messages
  if (loglevel) {
    logLevel = loglevel;
  } else if (appId) {
    logLevel = "info";
  } else {
    logLevel = "warning";
  }
  console.log(pc.blue(`Using log level ${logLevel}`));
  let noLintingErrors = true;
  if (!appId) {
    noLintingErrors = (await umbrelAppStoreYml(cwd)) && noLintingErrors;
    noLintingErrors = (await readmeMd(cwd)) && noLintingErrors;
  }
  const appIds = appId ? [appId] : await getAllAppIds(cwd);
  const umbrelAppYmls = await getUmbrelAppYmls(cwd);
  for (const id of appIds) {
    const files = await readDirRecursive(path.resolve(cwd, id));
    files.forEach((file) => (file.path = `${id}/${file.path}`));
    noLintingErrors =
      (await umbrelAppYml(cwd, id, umbrelAppYmls)) && noLintingErrors;
    // we restrict the use of checkImageArchitectures to the case where only one app is being linted
    // otherwise we would run into GitHub rate limits
    // umbrel lint => checkImageArchitectures = false
    // umbrel lint app-id => checkImageArchitectures = true
    noLintingErrors =
      (await dockerComposeYml(cwd, id, files, {
        checkImageArchitectures: appIds.length === 1,
      })) && noLintingErrors;
    noLintingErrors = lintDirectoryStructure(files) && noLintingErrors;
  }
  console.log(
    noLintingErrors
      ? pc.green("No linting errors found 🎉")
      : pc.red("Linting failed."),
  );
  return noLintingErrors ? 0 : 1;
}

async function umbrelAppStoreYml(cwd: string): Promise<boolean> {
  if ((await getAppStoreType(cwd)) === "official") {
    return true;
  }
  console.log("Checking umbrel-app-store.yml");

  // Check if the file exists
  const umbrelAppStoreYmlPath = path.resolve(cwd, "umbrel-app-store.yml");
  if (!(await exists(umbrelAppStoreYmlPath))) {
    printLintingError(
      "umbrel-app-store.yml does not exist",
      "For community app stores, the file umbrel-app-store.yml is required",
    );
    return false;
  }

  const lintingResults = await lintUmbrelAppStoreYml(
    await fs.readFile(umbrelAppStoreYmlPath, "utf-8"),
  );
  for (const result of lintingResults) {
    printLintingError(result.title, result.message, result.severity);
  }

  return lintingResults.filter((r) => r.severity === "error").length === 0;
}

async function readmeMd(cwd: string): Promise<boolean> {
  console.log("Checking README.md");
  const readmeMdPath = path.resolve(cwd, "README.md");
  if (!(await exists(readmeMdPath))) {
    printLintingError(
      "README.md does not exist",
      "A README.md file is highly recommended to tell users, how to install your App Store and what apps are available",
      "warning",
    );
    return false;
  }
  return true;
}

async function umbrelAppYml(
  cwd: string,
  id: string,
  allUmbrelAppYmlContents: string[],
): Promise<boolean> {
  console.log(`Checking ${path.join(id, "umbrel-app.yml")}`);
  const umbrelAppYmlPath = path.resolve(cwd, id, "umbrel-app.yml");
  // Check if the file exists
  if (!(await exists(umbrelAppYmlPath))) {
    printLintingError(
      "umbrel-app.yml does not exist",
      `Every app needs a manifest file called "umbrel-app.yml" at the root of the app directory`,
    );
    return false;
  }

  const lintingResults = await lintUmbrelAppYml(
    await fs.readFile(umbrelAppYmlPath, "utf-8"),
    id,
    { allUmbrelAppYmlContents },
  );
  for (const result of lintingResults) {
    printLintingError(result.title, result.message, result.severity);
  }

  return lintingResults.filter((r) => r.severity === "error").length === 0;
}

function lintDirectoryStructure(files: Entry[]): boolean {
  const lintingResults = directoryStructure(files);
  for (const result of lintingResults) {
    printLintingError(result.title, result.message, result.severity);
  }
  return lintingResults.filter((r) => r.severity === "error").length === 0;
}

async function dockerComposeYml(
  cwd: string,
  id: string,
  files: Entry[],
  options: { checkImageArchitectures?: boolean } = {},
): Promise<boolean> {
  console.log(`Checking ${path.join(id, "docker-compose.yml")}`);

  const dockerComposeYmlPath = path.resolve(cwd, id, "docker-compose.yml");
  // Check if the file exists
  if (!(await exists(dockerComposeYmlPath))) {
    printLintingError(
      "docker-compose.yml does not exist",
      `Every app needs a docker compose file called "docker-compose.yml" at the root of the app directory`,
    );
    return false;
  }

  const lintingResults = await lintDockerComposeYml(
    await fs.readFile(dockerComposeYmlPath, "utf-8"),
    id,
    files,
    options,
  );
  for (const result of lintingResults) {
    printLintingError(result.title, result.message, result.severity);
  }

  return lintingResults.filter((r) => r.severity === "error").length === 0;
}

function printLintingError(
  title: string,
  message: string,
  severity: "error" | "warning" | "info" = "error",
) {
  let level;
  switch (severity) {
    case "error":
      level = pc.bgRed(pc.bold(" ERROR "));
      break;
    case "warning":
      level = pc.bgYellow(pc.bold(" WARNING "));
      break;
    case "info":
      level = pc.bgBlue(pc.bold(" INFO "));
      break;
  }
  if (severity === "info" && logLevel !== "info") {
    return;
  }
  if (severity === "warning" && logLevel === "error") {
    return;
  }
  console.log(`${level} ${pc.bold(title)}: ${pc.italic(pc.gray(message))}`);
}
