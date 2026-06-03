import { defineConfig } from 'tsdown';
import { resolve } from 'node:path';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: 'esm',
  target: 'node22',
  platform: 'node',
  dts: true,
  clean: true,
  // Emit .js / .d.ts rather than tsdown 0.22's default .mjs / .d.mts, so the
  // exports map and bin keep pointing at the right files. The package is
  // type: module, so .js is already ESM.
  fixedExtension: false,
  // The bundler does not read tsconfig `paths`, so the `@/` alias is declared
  // here too. Everything is bundled into dist, so the alias never reaches the
  // emitted output or the published type graph.
  alias: {
    '@': resolve(import.meta.dirname, 'src'),
  },
});
