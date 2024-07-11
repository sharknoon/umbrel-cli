import fs from "node:fs/promises";
import { exists } from "../utils/fs";
import path from "node:path";
import pc from "picocolors";
import { getAllAppIds, getAppStoreType } from "../modules/appstore";
import { getUmbrelAppYmls } from "../modules/apps";
import {
  lintDockerComposeYml,
  lintUmbrelAppStoreYml,
  lintUmbrelAppYml,
} from "../modules/lint";

export async function lint(cwd: string): Promise<number> {
  let noLintingErrors = true;
  noLintingErrors = (await umbrelAppStoreYml(cwd)) && noLintingErrors;
  noLintingErrors = (await readmeMd(cwd)) && noLintingErrors;
  for (const id of await getAllAppIds(cwd)) {
    noLintingErrors = (await umbrelAppYml(cwd, id)) && noLintingErrors;
    noLintingErrors = (await dockerComposeYml(cwd, id)) && noLintingErrors;
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
      "For community app stores, the file umbrel-app-store.yml is required"
    );
    return false;
  }

  const lintingResults = await lintUmbrelAppStoreYml(
    await fs.readFile(umbrelAppStoreYmlPath, "utf-8")
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
      "warning"
    );
    return false;
  }
  return true;
}

async function umbrelAppYml(cwd: string, id: string): Promise<boolean> {
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

  const lintingResults = await lintUmbrelAppYml(
    await fs.readFile(umbrelAppYmlPath, "utf-8")
  );
  for (const result of lintingResults) {
    printLintingError(result.title, result.message, result.severity);
  }

  return lintingResults.filter((r) => r.severity === "error").length === 0;
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

async function dockerComposeYml(cwd: string, id: string): Promise<boolean> {
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

  // Get a list of all files and directories in the app directory
  const rawFileList = await fs.readdir(path.resolve(cwd, id), {
    recursive: true,
  });
  const fileList = rawFileList.map((f) =>
    [id, ...f.split(path.sep)].join(path.posix.sep)
  );

  const lintingResults = await lintDockerComposeYml(
    await fs.readFile(dockerComposeYmlPath, "utf-8"),
    fileList,
    id
  );
  for (const result of lintingResults) {
    printLintingError(result.title, result.message, result.severity);
  }

  return lintingResults.filter((r) => r.severity === "error").length === 0;
}

function printLintingError(
  title: string,
  message: string,
  severity: "error" | "warning" | "info" = "error"
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
  console.log(`${level} ${pc.bold(title)}: ${pc.italic(pc.gray(message))}`);
}
