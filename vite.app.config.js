import wasm from 'vite-plugin-wasm';
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Root directory for the app
  root: 'src/demo',

  // Base public path when served
  publicDir: '/public',

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
      'three-pinata': resolve(__dirname, 'src/lib'),
    },
  },
  plugins: [
    wasm()
  ]
}); 