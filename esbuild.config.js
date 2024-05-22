import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['src/**/*'],
  bundle: true,
  minify: true,
  splitting: true,
  outdir: 'dist',
  platform: 'node',
  format: 'esm',
  packages: "external",
  loader: {
    '.handlebars': 'copy',
  },
})