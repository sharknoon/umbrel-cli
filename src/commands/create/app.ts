import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  cancel,
  group,
  intro,
  isCancel,
  log,
  note,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import { clone, init, listRemotes } from "isomorphic-git";
import color from "picocolors";
import http from "isomorphic-git/http/node";
import Handlebars from "handlebars";

export async function createApp() {
  console.clear();

  intro(`${color.bgBlue(color.white(" Create an Umbrel App "))}`);

  // Create or load the App Store
  let pathToAppStore: string;
  let appStoreType: "official" | "community";

  if (await areWeInTheOfficialAppStore()) {
    pathToAppStore = path.resolve();
    appStoreType = "official";
  } else if (await areWeInACommunityAppStore()) {
    pathToAppStore = path.resolve();
    appStoreType = "community";
  } else {
    log.info("You are not in an Umbrel App Store directory.");
    const result = await select({
      message: "Where would you like to publish your app?",
      options: [
        {
          value: "official",
          label: "In the official Umbrel App Store",
          hint: "the apps are publicly available and need to be reviewed by the Umbrel team",
        },
        {
          value: "community",
          label: "In a Community App Store",
          hint: "the apps are in your own git repository and do not need to be reviewed by the Umbrel team",
        },
      ],
    });

    if (isCancel(result)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }
    appStoreType = result as "official" | "community";

    if (appStoreType === "official") {
      pathToAppStore = await getUmbrelAppsRepository();
    } else {
      const appStoreAction = await select({
        message: "What would you like to do?",
        options: [
          {
            value: "create",
            label: "Create a new Community App Store",
          },
          {
            value: "use",
            label: "Use an existing Community App Store",
          },
        ],
      });

      if (isCancel(appStoreAction)) {
        cancel("Operation cancelled.");
        process.exit(0);
      }

      if (appStoreAction === "create") {
        pathToAppStore = await createCommunityAppStore();
      } else {
        pathToAppStore = await openCommunityAppStore();
      }
    }
  }

  log.info(`Using the App Store at ${pathToAppStore} to create a new app.`);

  const takenAppIds = await getAppIds(pathToAppStore);

  const appId = await text({
    message:
      "Please choose an id for your app. It should be unique and contain only alphabets (a-z) and dashes (-).",
    placeholder: "my-cool-app",
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
  const appDir = path.resolve(pathToAppStore, appId);
  await fs.mkdir(appDir, { recursive: true });

  // Create umbrel-app.yml
  const manifestTemplate = Handlebars.compile(
    await fs.readFile(
      path.resolve("dist", "templates", "umbrel-app.yml.handlebars"),
      "utf-8"
    )
  );
  const manifest = manifestTemplate({
    appId,
    repoName: "<repo>",
    isOfficialAppStore: appStoreType === "official",
  });
  await fs.writeFile(path.join(appDir, "umbrel-app.yml"), manifest, "utf-8");

  // Create docker-compose.yml
  const dockerComposeTemplate = Handlebars.compile(await fs.readFile(
    path.resolve("dist", "templates", "docker-compose.yml.handlebars"),
    "utf-8"
  ));
  const dockerCompose = dockerComposeTemplate({});
  await fs.writeFile(
    path.join(appDir, "docker-compose.yml"),
    dockerCompose,
    "utf-8"
  );

  // Create exports.sh
  const exportsTemplate = Handlebars.compile(await fs.readFile(
    path.resolve("dist", "templates", "exports.sh.handlebars"),
    "utf-8"
  ));
  const exports = exportsTemplate({});
  await fs.writeFile(path.join(appDir, "exports.sh"), exports, "utf-8");

  note(`Bla Blub`, "Next steps.");

  outro(
    `Problems? ${color.underline(
      color.cyan("https://github.com/sharknoon/umbrel-cli/issues")
    )}`
  );
}

async function areWeInTheOfficialAppStore(): Promise<boolean> {
  try {
    const remotes = await listRemotes({ fs, dir: path.resolve() });
    return remotes.some(
      (remote) => remote.url === "https://github.com/getumbrel/umbrel-apps.git"
    );
  } catch (error) {
    return false;
  }
}

async function areWeInACommunityAppStore(): Promise<boolean> {
  try {
    await fs.access("umbrel-app-store.yml");
    return true;
  } catch (error) {
    return false;
  }
}

async function getAppIds(appStorePath: string): Promise<string[]> {
  const files = await fs.readdir(appStorePath, { withFileTypes: true });
  return files
    .filter((file) => file.isDirectory() && !file.name.startsWith("."))
    .map((file) => file.name);
}

async function getUmbrelAppsRepository(): Promise<string> {
  const s = spinner();
  s.start("Pulling the official Umbrel App Store from GitHub");
  const pathToAppStore = path.resolve(
    os.homedir(),
    ".umbrel-cli",
    "umbrel-apps"
  );
  await fs.mkdir(pathToAppStore, { recursive: true });
  await clone({
    fs,
    http,
    dir: pathToAppStore,
    url: "https://github.com/getumbrel/umbrel-apps.git",
    depth: 1,
    singleBranch: true,
  });
  s.stop("Finished pulling the official Umbrel App Store");

  return pathToAppStore;
}

async function createCommunityAppStore(): Promise<string> {
  const project = await group(
    {
      path: () =>
        text({
          message:
            'Where should we create the appstore? The path should contain only alphabets ("a to z") and dashes ("-")',
          placeholder: "./umbrel-app-store",
          initialValue: "./umbrel-app-store",
          validate: (value) => {
            if (!value) return "Please enter a path.";
            if (value[0] !== ".") return "Please enter a relative path.";
            if (!/^\.(?:\/[a-z]+(?:-[a-z]+)*)+$/.test(value))
              return "Please enter a valid path.";
            return undefined;
          },
        }),
      id: () =>
        text({
          message:
            'Choose the ID for your app store. This should contain only alphabets ("a to z") and dashes ("-").',
          placeholder: "sharknoon",
          validate: (value) => {
            if (!value) return "Please enter an ID.";
            if (!/^[a-z]+(?:-[a-z]+)*$/.test(value))
              return "Please enter a valid ID.";
            if (value === "umbrel-app-store")
              return "Please choose a different ID.";
            return undefined;
          },
        }),
      name: () =>
        text({
          message:
            'Choose the name of your app store. It will show up in the UI as "<name> App Store".',
          placeholder: "Sharknoons",
          validate: (value) => {
            if (!value) return "Please enter a name.";
            return undefined;
          },
        }),
    },
    {
      onCancel: () => {
        cancel("Operation cancelled.");
        process.exit(0);
      },
    }
  );

  const s = spinner();
  s.start("Initializing the Community App Store");

  // project directory
  project.path = path.resolve(project.path);
  await fs.mkdir(project.path, { recursive: true });

  // umbrel-app-store.yml
  const umbrelAppStoreYml = `id: ${project.id} # Choose the ID for your app store. This should contain only alphabets ("a to z") and dashes ("-").\nname: "${project.name}" # Choose the name of your app store. It will show up in the UI as "<name> App Store".`;
  await fs.writeFile(
    path.join(project.path, "umbrel-app-store.yml"),
    umbrelAppStoreYml,
    "utf-8"
  );

  // .gitignore
  const gitignore = `.DS_Store`;
  await fs.writeFile(path.join(project.path, ".gitignore"), gitignore, "utf-8");

  // README.md
  const readme = `# ${project.name} App Store\n\nThis is a community app store for [Umbrel](https://umbrel.com). It was generated using the [Umbrel CLI](https://npmjs.org/package/umbrel).\n`;
  await fs.writeFile(path.join(project.path, "README.md"), readme, "utf-8");

  // git init
  await init({ fs, dir: project.path });

  s.stop("Finished initializing the Community App Store");

  return project.path;
}

async function openCommunityAppStore(): Promise<string> {
  const inputpath = await text({
    message: "Enter the path to the Community App Store",
    placeholder: "./umbrel-app-store",
    validate: (value) => {
      if (!value) return "Please enter a path.";
      if (value[0] !== ".") return "Please enter a relative path.";
      if (!/^\.(?:\/[a-z]+(?:-[a-z]+)*)+$/.test(value))
        return "Please enter a valid path.";
      if (!fsSync.existsSync(path.resolve(value, "umbrel-app-store.yml")))
        return "This is not a valid Umbrel App Store (umbrel-app-store.yml is missing).";
      return undefined;
    },
  });

  if (isCancel(inputpath)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  return path.resolve(inputpath);
}
