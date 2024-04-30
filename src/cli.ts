#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createApp } from "./commands/create/app";

yargs(hideBin(process.argv))
  .scriptName("umbrel")
  .command(
    "create app",
    "Initalizes a new Umbrel App",
    () => {},
    () => createApp()
  )
  .demandCommand(1)
  .parse();
