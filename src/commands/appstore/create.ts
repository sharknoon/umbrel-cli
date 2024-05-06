import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  cancel,
  group,
  isCancel,
  note,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";
import color from "picocolors";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node/index.js";
import Handlebars from "handlebars";
import { isAppStoreDirectory } from "../../utils/appstore";

export async function create(name?: string) {
  if (await isAppStoreDirectory()) {
    note(
      `  Get started by creating a new app using: ${color.cyan(
        color.bold("umbrel app create")
      )}
  If you want to init a new App Store anyway, please navigate to a different directory.`,
      color.green("You are already in an Umbrel App Store directory 🚀")
    );
    outro(
      `Problems? ${color.underline(
        color.cyan("https://github.com/sharknoon/umbrel-cli/issues")
      )}`
    );
    process.exit(1);
  }

  let pathToAppStore = await text({
    message: `Where would you like to create the App Store? The path should contain only alphabets ("a to z") and dashes ("-").`,
    placeholder: "./umbrel-apps",
    initialValue: name ? `./${name}` : "./umbrel-apps",
    validate: (value) => {
      if (!value) return "Please enter a path.";
      if (value[0] !== ".") return "Please enter a relative path.";
      if (!/^\.(?:\/[a-z]+(?:-[a-z]+)*)+$/.test(value))
        return "Please enter a valid path.";
      if (existsSync(path.resolve(value)))
        return "The directory already exists. Please choose a different path.";
      return undefined;
    },
  });
  if (isCancel(pathToAppStore)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }
  pathToAppStore = path.resolve(pathToAppStore);

  const result = await select({
    message: "Which type of App Store would you like to initialize?",
    options: [
      {
        value: "official",
        label: "Official Umbrel App Store",
        hint: "the apps are publicly available and need to be reviewed by the Umbrel team",
      },
      {
        value: "community",
        label: "Community App Store",
        hint: "the apps are in your own git repository and do not need to be reviewed by the Umbrel team",
      },
    ],
  });
  if (isCancel(result)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }
  const appStoreType = result as "official" | "community";

  if (appStoreType === "official") {
    await cloneUmbrelAppsRepository(pathToAppStore.toString());
  } else {
    await createCommunityAppStore(pathToAppStore.toString());
  }

  note(
    `Create your first app with\n${color.cyan(
      color.bold("umbrel app create")
    )}`,
    "Next steps"
  );

  outro(
    `Problems? ${color.underline(
      color.cyan("https://github.com/sharknoon/umbrel-cli/issues")
    )}`
  );
}

async function cloneUmbrelAppsRepository(dir: string) {
  const s = spinner();
  s.start("Pulling the official Umbrel App Store from GitHub");
  await fs.mkdir(dir, { recursive: true });
  await git.clone({
    fs,
    http,
    dir,
    url: "https://github.com/getumbrel/umbrel-apps.git",
    depth: 1,
    singleBranch: true,
  });
  s.stop("Finished pulling the official Umbrel App Store");
}

async function createCommunityAppStore(dir: string) {
  const project = await group(
    {
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
  await fs.mkdir(dir, { recursive: true });

  // umbrel-app-store.yml
  const umbrelAppStoreTemplate = Handlebars.compile(
    await fs.readFile(
      path.resolve(
        __dirname,
        "templates",
        "appstore",
        "umbrel-app-store.yml.handlebars"
      ),
      "utf-8"
    )
  );
  const umbrelAppStoreYml = umbrelAppStoreTemplate({ project });
  await fs.writeFile(
    path.join(dir, "umbrel-app-store.yml"),
    umbrelAppStoreYml,
    "utf-8"
  );

  // .gitignore
  const gitignoreTemplate = Handlebars.compile(
    await fs.readFile(
      path.resolve(__dirname, "templates", "appstore", "gitignore.handlebars"),
      "utf-8"
    )
  );
  const gitignore = gitignoreTemplate({});
  await fs.writeFile(path.join(dir, ".gitignore"), gitignore, "utf-8");

  // README.md
  const readmeTemplate = Handlebars.compile(
    await fs.readFile(
      path.resolve(__dirname, "templates", "appstore", "README.md.handlebars"),
      "utf-8"
    )
  );
  const readme = readmeTemplate({ project });
  await fs.writeFile(path.join(dir, "README.md"), readme, "utf-8");

  // git init
  await git.init({ fs, dir: dir, defaultBranch: "main" });

  s.stop("Finished initializing the Community App Store");
}
