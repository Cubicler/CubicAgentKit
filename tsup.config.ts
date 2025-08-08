import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2023',
  outDir: 'dist',
  splitting: false,
  bundle: true,
  minify: false,
  external: ['express', 'axios', 'better-sqlite3', 'eventsource']
});
