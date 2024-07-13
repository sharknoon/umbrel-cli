import path from "node:path";
import fs from "node:fs/promises";
import YAML from "yaml";
import { cancel, intro, isCancel, text } from "@clack/prompts";
import pc from "picocolors";
import { getAllAppIds } from "../modules/appstore";
import { MESSAGE_ABORTED } from "../modules/console";
import { exit } from "../modules/process";
import { exists } from "../utils/fs";
import { ComposeSpecification } from "../schemas/docker-compose.yml.schema";
import { Image } from "../modules/image";

export async function update(cwd: string, id?: string) {
  console.clear();
  intro(`${pc.bgBlue(pc.white(" Update an Umbrel App "))}`);

  const appIds = await getAllAppIds(cwd);

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
  const images: Image[] = [];
  for (const service in dockerComposeYml.services ?? {}) {
    const image = dockerComposeYml.services?.[service]?.image;
    if (!image) {
      continue;
    }
    try {
      images.push(await Image.fromString(image));
    } catch (e) {
      cancel(`The service '${service}' has an invalid image '${image}': ${e}`);
      return;
    }
  }

  console.log(JSON.stringify(images));
}
