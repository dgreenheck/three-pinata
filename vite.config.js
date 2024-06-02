import path from 'path';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

/** @type {import('vite').UserConfig} */
export default {
  base: '/three-pinata/',
  build: {
    outDir: './dist',
    sourcemap: true,
  },
  plugins: [wasm(), topLevelAwait()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
};