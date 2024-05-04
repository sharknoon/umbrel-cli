import fs from "node:fs/promises";
import { log } from "@clack/prompts";
import YAML from "yaml";
import { isOfficialAppStoreDirectory } from "../utils/appstore";
import { exists } from "../utils/fs";
import umbrelAppStoreYmlSchema from "../schemas/appstore/umbrel-app-store.yml.schema";

export async function lint() {
  lintUmbrelAppStoreYml();
}

async function lintUmbrelAppStoreYml() {
  if (await isOfficialAppStoreDirectory()) {
    return;
  }

  // Check if the file exists
  if (!(await exists("umbrel-app-store.yml"))) {
    printLintingError(
      "umbrel-app-store.yml does not exist.",
      "For community app stores, the file umbrel-app-store.yml is required."
    );
    return;
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
  }

  // zod parse the file
  const result = umbrelAppStoreYmlSchema.safeParse(umbrelAppStoreYml);
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      printLintingError(
        `umbrel-app-store.yml: ${issue.path.join(".")}`,
        issue.message
      );
    });
  }
}

function printLintingError(
  title: string,
  message: string,
  severity: "error" | "warning" = "error"
) {
  log[severity](`${title}: ${message}`);
}
