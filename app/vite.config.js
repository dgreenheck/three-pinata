import path from 'path';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

/** @type {import('vite').UserConfig} */
export default {
  base: process.env.NODE_ENV === 'production' ? '/three-pinata/' : '/',
  build: {
    outDir: './dist',
    sourcemap: true,
    rollupOptions: {
      // Required to prevent Rapier issue: https://github.com/dimforge/rapier.js/issues/278
      treeshake: false
    }
  },
  plugins: [wasm(), topLevelAwait()],
  resolve: {
    alias: {
      '@dgreenheck/three-pinata': path.resolve(__dirname, '../lib/src'),
    },
  }
};