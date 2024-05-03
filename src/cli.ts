#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { create as createAppStore } from "./commands/appstore/create";
import { create as createApp } from "./commands/app/create";
import { isAppStoreDirectory } from "./utils/appstore";
import color from "picocolors";
import { intro, note, outro } from "@clack/prompts";

async function requireAppStoreDirectory() {
  console.log("test")
  if (!(await isAppStoreDirectory())) {
    intro(`${color.bgRed(color.black(" Oh no 😢 "))}`);
    note(
      `Please navigate to an Umbrel App Store directory\nor create a new one using ${color.cyan(
        color.bold("umbrel appstore create [name]")
      )}.`,
      color.red(color.bold("You are not in an Umbrel App Store directory!"))
    );
    outro(
      `Problems? ${color.underline(
        color.cyan("https://github.com/sharknoon/umbrel-cli/issues")
      )}`
    );
    process.exit(1);
  }
}

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
      await requireAppStoreDirectory();
      createApp(argv.name as string | undefined);
    }
  )
  .demandCommand(1)
  .strict()
  .parse();
