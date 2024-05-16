import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

/** @type {import('vite').UserConfig} */
export default {
  plugins: [wasm(), topLevelAwait()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
};
