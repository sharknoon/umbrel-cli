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

  const appDir = path.resolve(pathToAppStore, appId);
  await fs.mkdir(appDir, { recursive: true });

  const repoName = "<repo>";

  const manifest = `# There are currently two manifest versions: 1 and 1.1. Version 1 is the basic version and is sufficient for most apps.
# However, if your app requires the use of hooks (scripts that are run at different stages of the app lifecycle), you need to use version 1.1.
# Hooks allow you to perform custom actions at different stages of the app's lifecycle, such as before the app starts (pre-start), after the
# app installs (post-install), and more. If your app doesn't need to use hooks, you can stick with manifest version 1.
manifestVersion: 1.1

# The ID should be unique within the app store and contain only alphabets (a-z) and dashes (-).
# It should be human readable and recognizable.
# The value "umbrel-app-store" and the id of your Community App Store are reserved and cannot be used.
id: ${appId}

# Disabled apps are not shown in the app store. This is useful for apps that are still in development. (optional)
#disabled: false

# This is the name of your App. It will show up in the App Store as well as on the home screen of Umbrel.
name: My Cool App

# The tagline should describe your app in one sentence. Do not use more than 100 characters.
tagline: The coolest app ever

# This is the icon displayed in the App Store as well as on the home screen.
# The icon is only needed for community App Stores. For the official Umbrel App Store, the icon will be uploaded via the Pull Request and stored
# in a separate repostiory (https://github.com/getumbrel/umbrel-apps-gallery).
${
  appStoreType === "official"
    ? `#icon: https://getumbrel.github.io/umbrel-apps-gallery/${appId}/icon.svg`
    : `icon: https://raw.githubusercontent.com/<user>/${repoName}/main/${appId}/icon.svg`
}

# The category should be one of the following: "files", "bitcoin", "media", "networking", "social", "automation", "finance", "ai" or "developer".
category: files

# The version of your app. This should be a string that follows the semantic versioning scheme (https://semver.org/).
# The version should correspond to the version of the upstream application.
version: "1.0.0"

# The port your app is reachable from a webbrowser. This should be a number between 1024 and 65535.
port: 3000

# A description of your app. This will be shown in the App Store.
description: >-
  This is the best app you have ever seen. It does everything you ever wanted and more.

  It also supports new lines.

# The developer of the app. This is not necessarily the submitter but the actual developer of the app.
developer: John Doe

# The website of the app. This should be the official website of the app.
website: http://example.com

# The submitter of the app. This is the person who submits the app to the App Store (probably you).
submitter: Jane Doe

# The submission URL. This should be a link to the pull request or the commit that adds the app to the App Store.
${
  appStoreType === "official"
    ? `submission: https://github.com/getumbrel/umbrel-apps/pull/<number>`
    : `submission: https://github.com/<user>/${repoName}/commit/<full-commit-sha>`
}

# The repository of the app. This should be a link to the repository of the app. (optional)
#repo: https://github.com/<user>/<repo>

# The support URL. This should be a link to the support page of the app.
support: https://github.com/<user>/<repo>/discussions

# The gallery is an array of filenames (Official App Store) or URLs (Community App Stores) to images that will be shown in the App Store.
${
  appStoreType === "official"
    ? `gallery:\n  - 1.jpg\n  - 2.jpg`
    : `gallery:\n  - https://raw.githubusercontent.com/<user>/${repoName}/main/${appId}/1.jpg\n  - https://raw.githubusercontent.com/<user>/${repoName}/main/${appId}/2.jpg`
}

# The release notes of the app. This should be a string that describes the changes in the new version. (optional)
#releaseNotes: >-
#  This is a new version of the app.
#  
#  It has some new features and some bug fixes.

# The dependencies of the app. This should be an array of IDs of apps that this app depends on. (optional)
#dependencies: []

# The permissions of the app. This should be an array of permissions that the app requires. (optional)
# Available permissions are: 
# - STORAGE_DOWNLOADS: Allows the app to download files to the storage.
#permissions: []

# If the app is only accessible via a subpath, you can specify it here. (optional)
#path: /web

# If the user needs to know about a default username and password, you can specify it here. (optional)
#defaultUsername: admin
#defaultPassword: admin

# If true, Umbrel will generate a deterministic password for the app. (optional)
# It will be shown to the user in the Umbrel UI and can be used inside the docker-compose.yml as the $APP_PASSWORD variable.
# This will also override the defaultPassword if set.
#deterministicPassword: false

# If the app is optimized for the Umbrel Home (https://umbrel.com/umbrel-home), you can specify it here. (optional)
#optimizedForUmbrelHome: false

# If true, the app is only accessible via Tor. (optional)
# Users will need to access their Umbrel in a Tor browser on their remote access URL (Settings > Remote Tor access) to open the app.
#torOnly: false

# If the size of the app is known, you can specify it here. (optional)
# It will be shown on the "Install" button in the App Store.
# IMPORTANT: The size needs to be in bytes.
#installSize: 10000

# Widgets are small UI elements that can be shown on the Umbrel home screen. (optional)
# You can specify an array of widgets.
# Examples:
# The ID should be unique within the app and contain only alphabets (a-z) and dashes (-)
#- id: "disk-usage"
#  # The type of the widget. Available widgets are: "text-with-buttons", "text-with-progress",
#  # "two-stats-with-guage", "three-stats", "four-stats", "list-emoji" and "list".
#  # To see how they look, visit http://umbrel.local/stories/widgets.
#  type: "text-with-progress"
#  # How often the widget should update. See all available options here: https://github.com/vercel/ms/blob/main/readme.md
#  refresh: "1m"
#  # The endpoint to fetch the data from.
#  # The hostname is the service from the docker-compose.yml.
#  endpoint: "server:80/api/widgets/disk-usage"
#  # On click of the widget, the app will open. (optional)
#  # The link (which is actually a path) will be appended to the app's URL.
#  # When the link is an empty string, the app will open as if the icon was clicked.
#  link: "/disk-usage"
#  # An example of the widget to show off the widget in the widget picker.
#  example:
    type: "text-with-progress"
    link: ""
    title: "Time Machine Usage"
    text: "420 GB"
    progressLabel: "580 GB left"
    progress: 0.42
#widgets: []

# If you are opening the terminal of an app (Settings > Advanced settings > Terminal), you can specify the default docker compose service name here. (optional)
# This is useful, if you have multiple services in your docker-compose.yml and want to open the terminal of a specific service.
#defaultShell: app`;

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
