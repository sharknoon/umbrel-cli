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
import { exit } from "./modules/process";
import { printErrorOccured } from "./modules/console";

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
    "appstore create [id]",
    "Initalizes a new Umbrel App Store (official or community)",
    (yargs) => {
      yargs.positional("id", {
        type: "string",
        describe:
          "The id of the App Store (only alphabets (a-z) and dashes (-))",
        default: "",
      });
    },
    async (argv) => {
      await createAppStore(argv.w, argv.id as string | undefined);
    }
  )
  .command(
    "app create [id]",
    "Creates a new Umbrel App",
    (yargs) => {
      yargs.positional("id", {
        type: "string",
        describe: "The id of the app (only alphabets (a-z) and dashes (-))",
        default: "",
      });
    },
    async (argv) => {
      console.clear();
      intro(`${pc.bgBlue(pc.white(" Initialize an Umbrel App "))}`);
      await requireAppStoreDirectory(argv.w);
      await createApp(argv.w, argv.id as string | undefined);
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
      await exit(result);
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
    "test [id]",
    "Installs an app on Umbrel and executes it",
    (yargs) => {
      yargs.positional("id", {
        type: "string",
        describe: "The id of the app to be tested",
        default: "",
      });
      yargs.option("host", {
        type: "string",
        alias: "H",
        default: "umbrel.local",
        describe: "The hostname to connect via SSH to your Umbrel",
      });
      yargs.option("port", {
        type: "number",
        alias: "P",
        default: 22,
        describe: "The port to connect via SSH to your Umbrel",
      });
      yargs.option("username", {
        type: "string",
        alias: "u",
        default: "umbrel",
        describe: "The username to connect via SSH to your Umbrel",
      });
      yargs.option("password", {
        type: "string",
        alias: "p",
        describe: "The password to connect via SSH to your Umbrel",
      });
    },
    async (argv) => {
      await requireAppStoreDirectory(argv.w);
      // @ts-expect-error somehow id is not detected properly
      await test(argv.w, argv.id, argv.host, argv.port, argv.username, argv.password);
    }
  )
  .alias("v", "version")
  .alias("h", "help")
  .demandCommand(1)
  .strict()
  .parseAsync()
  .catch(async (error) => {
    printErrorOccured(error);
    await exit(1);
  });

async function requireAppStoreDirectory(cwd: string) {
  if (!(await isAppStoreDirectory(cwd))) {
    console.log(
      pc.red(pc.bold("You are not in an Umbrel App Store directory!"))
    );
    console.log();
    console.log(`  Please navigate to an Umbrel App Store directory`);
    console.log(
      `  or create a new one using ${pc.cyan(
        pc.bold("umbrel appstore create [id]")
      )}.`
    );
    console.log();
    await exit(1);
  }
}
