import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts', 'src/templates/*'],
  clean: true,
  minify: true,
  loader: { '.handlebars': 'copy' },
})
