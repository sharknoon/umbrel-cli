import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  clean: true,
  minify: true
})
