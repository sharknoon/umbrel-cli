#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { create as createAppStore } from "./commands/appstore/create";
import { create as createApp } from "./commands/app/create";
import { isAppStoreDirectory } from "./utils/appstore";
import pc from "picocolors";
import { intro } from "@clack/prompts";
import { lint } from "./commands/lint";
import { port } from "./commands/generate/port";

await yargs(hideBin(process.argv))
  .scriptName("umbrel")
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
      await createAppStore(argv.name as string | undefined);
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
      await requireAppStoreDirectory();
      await createApp(argv.name as string | undefined);
    }
  )
  .command(
    "lint",
    "Lints the current Umbrel App Store and all apps in it",
    () => {},
    async () => {
      await requireAppStoreDirectory();
      await lint();
    }
  )
  .command(
    "generate port",
    "Generates a random unused port number",
    () => {},
    async () => {
      await port();
    }
  )
  .demandCommand(1)
  .strict()
  .parseAsync();

async function requireAppStoreDirectory() {
  if (!(await isAppStoreDirectory())) {
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
