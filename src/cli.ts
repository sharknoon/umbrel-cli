#!/usr/bin/env node

import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { create as createAppStore } from "./commands/appstore/create";
import { create as createApp } from "./commands/app/create";
import pc from "picocolors";
import { intro } from "@clack/prompts";
import { lint } from "./commands/lint";
import { port } from "./commands/generate/port";
import { test } from "./commands/test";
import {
  cloneUmbrelAppsRepository,
  isAppStoreDirectory,
} from "./modules/appstore";
import { officialAppStoreDir } from "./modules/paths";

await cloneUmbrelAppsRepository(officialAppStoreDir);

await yargs(hideBin(process.argv))
  .scriptName("umbrel")
  .option("w", {
    alias: "working-directory",
    default: process.cwd(),
    describe:
      "The working directory of this cli, to generate relative paths from",
    type: "string",
    coerce: (cwd) => path.resolve(cwd),
  })
  .command(
    "appstore create [name]",
    "Initalizes a new Umbrel App Store (official or community)",
    (yargs) => {
      yargs.positional("name", {
        type: "string",
        describe:
          "The name of the App Store (only alphabets (a-z) and dashes (-))",
        default: "",
      });
    },
    async (argv) => {
      console.clear();
      intro(`${pc.bgBlue(pc.white(" Initialize an Umbrel App Store "))}`);
      await createAppStore(argv.w, argv.name as string | undefined);
    }
  )
  .command(
    "app create [name]",
    "Creates a new Umbrel App",
    (yargs) => {
      yargs.positional("name", {
        type: "string",
        describe: "The name of the app (only alphabets (a-z) and dashes (-))",
        default: "",
      });
    },
    async (argv) => {
      console.clear();
      intro(`${pc.bgBlue(pc.white(" Initialize an Umbrel App "))}`);
      await requireAppStoreDirectory(argv.w);
      await createApp(argv.w, argv.name as string | undefined);
    }
  )
  .command(
    "lint",
    "Lints the current Umbrel App Store and all apps in it",
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    () => {},
    async (argv) => {
      await requireAppStoreDirectory(argv.w);
      const result = await lint(argv.w);
      process.exit(result);
    }
  )
  .command(
    "port generate",
    "Generates a random unused port number",
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    () => {},
    async (argv) => {
      await port(argv.w);
    }
  )
  .command(
    "test",
    "Installs an app on Umbrel and executes it",
    {
      host: {
        type: "string",
        alias: "i",
        default: "umbrel.local",
        describe: "The hostname of your Umbrel",
      },
    },
    async (argv) => {
      // @ts-ignore
      await requireAppStoreDirectory(argv.w);
      // @ts-ignore
      await test(argv.w, argv.host)
    }
  )
  .alias("v", "version")
  .alias("h", "help")
  .demandCommand(1)
  .strict()
  .parseAsync()
  .catch((error) => {
    console.error("Oh noooo: " + error);
    process.exit(1);
  });

async function requireAppStoreDirectory(cwd: string) {
  if (!isAppStoreDirectory(cwd)) {
    console.log(
      pc.red(pc.bold("You are not in an Umbrel App Store directory!"))
    );
    console.log();
    console.log(`  Please navigate to an Umbrel App Store directory`);
    console.log(
      `  or create a new one using ${pc.cyan(
        pc.bold("umbrel appstore create [name]")
      )}.`
    );
    console.log();
    process.exit(1);
  }
}
