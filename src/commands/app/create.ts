import fs from "node:fs/promises";
import path from "node:path";
import {
  cancel,
  intro,
  isCancel,
  log,
  note,
  outro,
  text,
} from "@clack/prompts";
import color from "picocolors";
import Handlebars from "handlebars";
import {
  getAppStoreId,
  isOfficialAppStoreDirectory,
} from "../../utils/appstore";

export async function create(name?: string) {
  console.clear();

  intro(`${color.bgBlue(color.white(" Create an Umbrel App "))}`);

  // Create or load the App Store
  const pathToAppStore: string = path.resolve();
  const appStoreType = (await isOfficialAppStoreDirectory())
    ? "official"
    : "community";
  const appStoreId = await getAppStoreId();
  log.info(`Using the App Store at ${pathToAppStore} to create a new app.`);

  const takenAppIds = await getAppIds(pathToAppStore);

  const appId = await text({
    message:
      "Please choose an id for your app. It should be unique and contain only alphabets (a-z) and dashes (-).",
    placeholder: "my-cool-app",
    initialValue: name ? name : `my-cool-app`,
    validate: (value) => {
      if (!value) return "Please enter an id.";
      if (!/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/.test(value))
        return "Please enter a valid id.";
      if (takenAppIds.includes(value)) return "This id is already taken.";
      if (value === "umbrel-app-store")
        return "Please choose a different id. This id is reserved for the official Umbrel App Store.";
      if (value.length > 50) return "The id is too long.";
      return undefined;
    },
  });

  if (isCancel(appId)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  // Create the app directory
  const appDir = path.resolve(
    pathToAppStore,
    appStoreType === "official" ? appId : `${appStoreId}-${appId}`
  );
  await fs.mkdir(appDir, { recursive: true });

  // Create umbrel-app.yml
  const manifestTemplate = Handlebars.compile(
    await fs.readFile(
      path.resolve(__dirname, "templates", "app", "umbrel-app.yml.handlebars"),
      "utf-8"
    )
  );
  const manifest = manifestTemplate({
    appId,
    appStoreId,
    repoName: "<repo>",
    isOfficialAppStore: appStoreType === "official",
  });
  await fs.writeFile(path.join(appDir, "umbrel-app.yml"), manifest, "utf-8");

  // Create docker-compose.yml
  const dockerComposeTemplate = Handlebars.compile(
    await fs.readFile(
      path.resolve(
        __dirname,
        "templates",
        "app",
        "docker-compose.yml.handlebars"
      ),
      "utf-8"
    )
  );
  const dockerCompose = dockerComposeTemplate({});
  await fs.writeFile(
    path.join(appDir, "docker-compose.yml"),
    dockerCompose,
    "utf-8"
  );

  // Create exports.sh
  const exportsTemplate = Handlebars.compile(
    await fs.readFile(
      path.resolve(__dirname, "templates", "app", "exports.sh.handlebars"),
      "utf-8"
    )
  );
  const exports = exportsTemplate({});
  await fs.writeFile(path.join(appDir, "exports.sh"), exports, "utf-8");

  note(`Bla Blub`, "Next steps");

  outro(
    `Problems? ${color.underline(
      color.cyan("https://github.com/sharknoon/umbrel-cli/issues")
    )}`
  );
}

async function getAppIds(appStorePath: string): Promise<string[]> {
  const files = await fs.readdir(appStorePath, { withFileTypes: true });
  return files
    .filter((file) => file.isDirectory() && !file.name.startsWith("."))
    .map((file) => file.name);
}
