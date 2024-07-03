import fs from "node:fs/promises";
import path from "node:path";
import { cancel, group, confirm, log, note, outro, text } from "@clack/prompts";
import pc from "picocolors";
import Handlebars from "handlebars";
import {
  getUmbrelAppStoreYml,
  getAppStoreType,
  getAllAppIds,
} from "../../modules/appstore";
import { __dirname } from "../../utils/fs";
import { MESSAGE_ABORTED } from "../../modules/console";
import { exit } from "../../modules/process";

export async function create(cwd: string, id?: string) {
  // Create or load the App Store
  const appStoreType = await getAppStoreType(cwd);
  const appStoreId = (await getUmbrelAppStoreYml(cwd))?.id;
  log.info(`Using the App Store at ${cwd} to create a new app.`);

  const takenAppIds = await getAllAppIds(cwd);

  let defaultId = id || "my-cool-app";
  if (appStoreType === "community") {
    defaultId = `${appStoreId}-${defaultId}`;
  }

  const { appId, needsExportSh } = await group(
    {
      appId: () =>
        text({
          message: `Please choose an id for your app. It should be unique and contain only alphabets (a-z) and dashes (-). ${
            appStoreType === "community"
              ? `The id needs to be prefixed with '${appStoreId}-'.`
              : ""
          }`,
          placeholder: defaultId,
          initialValue: defaultId,
          validate: (value) => {
            if (!value) return "Please enter an id.";
            if (!/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/.test(value))
              return "Please enter a valid id.";
            if (takenAppIds.includes(value)) return "This id is already taken.";
            if (value.startsWith("umbrel-app-store"))
              return "Please choose a different id. This id is reserved for the official Umbrel App Store.";
            if (
              appStoreType === "community" &&
              !value.startsWith(`${appStoreId}-`)
            )
              return `The id needs to be prefixed with '${appStoreId}-'.`;
            if (value.length > 50) return "The id is too long.";
            return undefined;
          },
        }),
      needsExportSh: () =>
        confirm({
          message:
            "Does your app need to share environment variables with other apps? This is useful, for example, if another app needs to access an API provided by your app.",
          initialValue: false,
        }),
    },
    {
      // On Cancel callback that wraps the group
      // So if the user cancels one of the prompts in the group this function will be called
      onCancel: async () => {
        cancel(MESSAGE_ABORTED);
        await exit();
        return;
      },
    }
  );

  // Create the app directory
  const appDir = path.resolve(cwd, appId);
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
  if (needsExportSh) {
    const exportsTemplate = Handlebars.compile(
      await fs.readFile(
        path.resolve(__dirname, "templates", "app", "exports.sh.handlebars"),
        "utf-8"
      )
    );
    const exports = exportsTemplate({});
    await fs.writeFile(path.join(appDir, "exports.sh"), exports, "utf-8");
  }

  note(
    ` - fill out the ${pc.cyan(pc.bold("umbrel-app.yml"))}
 - add your containers to the ${pc.cyan(pc.bold("docker-compose.yml"))}${
   needsExportSh
     ? `\n - expose your environment variables for other apps in ${pc.cyan(
         pc.bold("exports.sh")
       )}`
     : ""
 }`,
    "Next steps"
  );

  outro(
    `Problems? ${pc.underline(
      pc.cyan("https://github.com/sharknoon/umbrel-cli/issues")
    )}`
  );
}
