import path, { parse } from "node:path";
import fs from "node:fs/promises";
import YAML from "yaml";
import { cancel, group, intro, isCancel, text } from "@clack/prompts";
import pc from "picocolors";
import { getAppIds } from "../modules/appstore";
import { MESSAGE_ABORTED } from "../modules/console";
import { exit } from "../modules/process";
import { exists } from "../utils/fs";
import { ComposeSpecification } from "../schemas/docker-compose.yml.schema";
import { parseImage } from "../modules/image";

export async function update(cwd: string, id?: string) {
  console.clear();
  intro(`${pc.bgBlue(pc.white(" Update an Umbrel App "))}`);

  const appIds = await getAppIds(cwd);

  if (id) {
    if (!appIds.includes(id)) {
      cancel(`The app with the id '${id}' does not exist.`);
      return;
    }
  } else {
    const value = await text({
      message: "Please enter the id of the app you want to update.",
      validate: (value) => {
        if (!value) return "The id is required.";
        if (!appIds.includes(value)) {
          return `The app with the id '${value}' does not exist.`;
        }
        return undefined;
      },
    });

    if (isCancel(value)) {
      cancel(MESSAGE_ABORTED);
      await exit();
      return;
    }
    id = value;
  }

  // Get the docker compose file
  const dockerComposeYmlPath = path.resolve(cwd, id, "docker-compose.yml");
  if (!(await exists(dockerComposeYmlPath))) {
    cancel("docker-compose.yml does not exist");
    return;
  }
  const rawDockerComposeYml = await fs.readFile(dockerComposeYmlPath, "utf-8");
  let dockerComposeYml: ComposeSpecification;
  try {
    dockerComposeYml = YAML.parse(rawDockerComposeYml, {
      merge: true,
    });
  } catch (e) {
    cancel("docker-compose.yml is not a valid YAML file: " + e);
    return false;
  }
  const images = [];
  for (const service in dockerComposeYml.services ?? {}) {
    const image = dockerComposeYml.services?.[service]?.image;
    if (!image) {
      continue;
    }
    try {
      images.push(await parseImage(image));
    } catch (e) {
      cancel(`The service '${service}' has an invalid image '${image}': ${e}`);
      return;
    }
  }

  console.log(JSON.stringify(images));

  /* const { appId, needsExportSh } = await group(
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
      },
    }
  ); */
}
