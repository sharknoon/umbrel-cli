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
import { clone, init } from "isomorphic-git";
import color from "picocolors";
import http from "isomorphic-git/http/node";
import { isValidUrl } from "../../utils/net";
import semver from "semver";

export async function createApp() {
  console.clear();

  intro(`${color.bgBlue(color.white(" Create an Umbrel App "))}`);

  // Create or load the App Store
  let pathToAppStore: string;
  let appStoreType: "official" | "community";
  try {
    // Check if we are already in an App Store directory
    await fs.access("umbrel-app-store.yml");
    pathToAppStore = path.resolve("");
  } catch (error) {
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
        pathToAppStore = await createAppStore();
      } else {
        pathToAppStore = await askForAppStoreLocation();
      }
    }
  }

  log.info(`Using the App Store at ${pathToAppStore} to create a new app.`);

  const takenAppIds = await getAppIds(pathToAppStore);

  const manifest = group(
    {
      id: () =>
        text({
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
        }),
      name: () =>
        text({
          message: "Please enter the name of your app.",
          placeholder: "My Cool App",
          validate: (value) => {
            if (!value) return "Please enter a name.";
            if (value.length > 50) return "The name is too long.";
            return undefined;
          },
        }),
      tagline: () =>
        text({
          message:
            "Please enter a tagline for your app. The tagline should pitch your app in one sentence.",
          placeholder: "The coolest app on Umbrel",
          validate: (value) => {
            if (!value) return "Please enter a tagline.";
            if (value.length > 100) return "The tagline is too long.";
            return undefined;
          },
        }),
      icon: () => {
        if (appStoreType === "community") {
          return text({
            message: "Please enter the url of the app icon. (optional)",
            placeholder:
              "https://raw.githubusercontent.com/user/repo/main/my-cool-app/icon.svg",
            validate: (value) => {
              if (value.length > 0 && !isValidUrl(value))
                return "Please enter a valid URL.";
              return undefined;
            },
          });
        }
        return undefined;
      },
      category: () =>
        select({
          message: "Please choose a category for your app.",
          options: [
            // @ts-ignore
            { value: "files", label: "Files & Productivity" },
            // @ts-ignore
            { value: "bitcoin", label: "Bitcoin" },
            // @ts-ignore
            { value: "media", label: "Media" },
            // @ts-ignore
            { value: "networking", label: "Networking" },
            // @ts-ignore
            { value: "social", label: "Social" },
            // @ts-ignore
            { value: "automation", label: "Home & Automation" },
            // @ts-ignore
            { value: "finance", label: "Finance" },
            // @ts-ignore
            { value: "ai", label: "AI" },
            // @ts-ignore
            { value: "developer", label: "Developer Tools" },
          ],
        }),
      version: () =>
        text({
          message:
            "Please enter the version of your app. This should correspond to the version of the upstream application.",
          placeholder: "1.0.0",
          validate: (value) => {
            if (!value) return "Please enter a version.";
            if (!semver.valid(value))
              return "Please enter a valid semver version (https://semver.org).";
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

  note(`Bla Blub`, "Next steps.");

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
