import { defineConfig } from "rollup";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import copy from "rollup-plugin-copy";
import nodeResolve from "@rollup/plugin-node-resolve";

export default defineConfig({
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
  ],
});
