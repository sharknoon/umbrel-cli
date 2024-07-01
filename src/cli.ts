#!/usr/bin/env node

import { hideBin } from "yargs/helpers";
import { main } from "./parser";

await main(hideBin(process.argv))