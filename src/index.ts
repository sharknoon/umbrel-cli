import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createAppstore } from "./commands/create/appstore";

yargs(hideBin(process.argv))
  .scriptName("umbrel")
  .command(
    "$0 create appstore",
    "Initalizes a new Umbrel community app store",
    () => {},
    (argv) => {
      createAppstore();
    }
  )
  .demandCommand(1)
  .parse();
