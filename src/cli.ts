#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { create as createAppStore } from "./commands/appstore/create";
import { create as createApp } from "./commands/app/create";
import { isAppStoreDirectory } from "./utils/appstore";
import color from "picocolors";
import { intro, note } from "@clack/prompts";
import { lint } from "./commands/lint";


yargs(hideBin(process.argv))
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
      intro(`${color.bgBlue(color.white(" Initialize an Umbrel App Store "))}`);
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
      intro(`${color.bgBlue(color.white(" Initialize an Umbrel App "))}`);
      await requireAppStoreDirectory();
      createApp(argv.name as string | undefined);
    }
  )
  .command(
    "lint",
    "Lints the current Umbrel App Store and all apps in it",
    () => {},
    async () => {
      console.clear();
      intro(`${color.bgBlue(color.white(" Linting Umbrel App Store and Apps"))}`);
      await requireAppStoreDirectory();
      lint();
    }
  )
  .demandCommand(1)
  .strict()
  .parse();

async function requireAppStoreDirectory() {
  if (!(await isAppStoreDirectory())) {
    note(
      `Please navigate to an Umbrel App Store directory\nor create a new one using ${color.cyan(
        color.bold("umbrel appstore create [name]")
      )}.`,
      color.red(color.bold("You are not in an Umbrel App Store directory!"))
    );
    process.exit(1);
  }
}