import path from 'path';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

/** @type {import('vite').UserConfig} */
export default {
  // Set the base directory for GitHub pages
  base: process.env.NODE_ENV === 'production' ? '/three-pinata/' : '/',
  build: {
    outDir: './dist',
    sourcemap: true,
  },
  publicDir: './public',
  plugins: [wasm(), topLevelAwait()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
};