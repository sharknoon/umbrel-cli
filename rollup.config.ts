import { defineConfig } from "rollup";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import copy from "rollup-plugin-copy";
import nodeResolve from "@rollup/plugin-node-resolve";
import { dts } from "rollup-plugin-dts";
import del from "rollup-plugin-delete";

export default defineConfig([
  {
    input: "src/cli.ts",
    output: {
      dir: "dist",
      format: "esm",
      plugins: [terser()],
    },
    external: [/node_modules/],
    plugins: [
      typescript(),
      json(),
      copy({
        targets: [{ src: "src/templates", dest: "dist" }],
      }),
      nodeResolve(),
      del({ targets: "dist/*" })
    ],
  },
  {
    input: "src/lib.ts",
    output: {
      dir: "dist",
      format: "esm",
      plugins: [terser()],
    },
    external: [/node_modules/],
    plugins: [
      typescript(),
      json(),
      copy({
        targets: [{ src: "src/templates", dest: "dist" }],
      }),
      nodeResolve()
    ],
  },
  {
    input: "dist/dts/src/lib.d.ts",
    output: [
      {
        file: "dist/lib.d.ts",
        format: "esm",
      },
    ],
    plugins: [dts(), del({ targets: "dist/dts", hook: "buildEnd" })],
  },
]);
