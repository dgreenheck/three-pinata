import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import path from 'path';

export default defineConfig({
  build: {
    plugins: [dts({
      outputDir: './dist',
      staticImport: true,
      insertTypesEntry: true
    })],
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'three-pinata',
      fileName: (format) => `three-pinata.${format}.js`
    },
    rollupOptions: {
      external: ['three'],
      output: {
        globals: {
          three: 'THREE'
        }
      }
    }
  }
});