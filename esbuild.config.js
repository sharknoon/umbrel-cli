import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['src/cli.ts', 'src/templates/**/*'],
  bundle: true,
  minify: false,
  outdir: 'dist',
  platform: 'node',
  format: 'esm',
  packages: "external",
  loader: {
    '.handlebars': 'copy',
  },
})