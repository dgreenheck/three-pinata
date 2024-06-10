import path from 'path';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

/** @type {import('vite').UserConfig} */
export default {
  base: '/examples/lion',
  build: {
    outDir: './dist',
    sourcemap: true,
    rollupOptions: {
      // Required to prevent Rapier issue: https://github.com/dimforge/rapier.js/issues/278
      treeshake: false
    }
  },
  root: 'examples/lion/',
  plugins: [wasm(), topLevelAwait()],
  resolve: {
    alias: {
      'three-pinata': path.resolve(__dirname, '../../dist/three-pinata.es.js')
    }
  }
};