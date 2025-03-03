import wasm from 'vite-plugin-wasm';
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Configure the build
  build: {
    // Generate source maps
    sourcemap: true,

    // Configure Rollup options
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  // Configure resolve options
  resolve: {
    alias: {
      // Allow importing from the library directly during development
      '@dgreenheck/three-pinata': resolve(__dirname, '../lib/src'),
    },
  },
  plugins: [
    wasm()
  ]
}); 