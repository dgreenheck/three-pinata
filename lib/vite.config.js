import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: resolve(__dirname, "./build"),
    lib: {
      // The entry point for your library
      entry: resolve(__dirname, "./src/index.ts"),
      formats: ["es", "umd"],
      // The name of your library
      name: "@dgreenheck/three-pinata",
      // The file name formats for different module systems
      fileName: (format) => `three-pinata.${format}.js`,
    },
    rollupOptions: {
      // Make sure to externalize dependencies that shouldn't be bundled
      // into your library
      external: ["three"],
      output: {
        // Provide global variables to use in UMD build
        globals: {
          three: "THREE",
        },
      },
    }
  }
});