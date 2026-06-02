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
  // The bundler does not read tsconfig `paths`, so the `@/` alias is declared
  // here too. Everything is bundled into dist, so the alias never reaches the
  // emitted output or the published type graph.
  alias: {
    '@': resolve(import.meta.dirname, 'src'),
  },
});
