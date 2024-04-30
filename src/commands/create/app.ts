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
import { cloneOrPullRepository } from "../../utils/git";
import { init } from "isomorphic-git";
import color from "picocolors";

export async function createApp() {
  console.clear();

  intro(`${color.bgBlue(color.white(" Create an Umbrel App "))}`);

  // Create or load the App Store
  let pathToAppStore: string;
  try {
    // Check if we are already in an App Store directory
    await fs.access("umbrel-app-store.yml");
    pathToAppStore = path.resolve("");
  } catch (error) {
    log.info("You are not in an Umbrel App Store directory.");
    const appStoreType = await select({
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

    if (isCancel(appStoreType)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

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
        pathToAppStore = await createAppStore();
      } else {
        pathToAppStore = await askForAppStoreLocation();
      }
    }
  }

  log.info(`Using the App Store at ${pathToAppStore} to create a new app.`);



  note(`Bla Blub`, "Next steps.");

  outro(
    `Problems? ${color.underline(
      color.cyan("https://github.com/sharknoon/umbrel-cli/issues")
    )}`
  );
}

async function getUmbrelAppsRepository(): Promise<string> {
  const s = spinner();
  s.start("Pulling the official Umbrel App Store from GitHub");
  const pathToAppStore = path.resolve(
    os.homedir(),
    ".umbrel-cli",
    "umbrel-apps"
  );
  await cloneOrPullRepository(
    pathToAppStore,
    "https://github.com/getumbrel/umbrel-apps.git"
  );
  s.stop("Finished pulling the official Umbrel App Store");

  return pathToAppStore;
}

async function createAppStore(): Promise<string> {
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

async function askForAppStoreLocation(): Promise<string> {
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
