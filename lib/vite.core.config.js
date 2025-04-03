import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  base: "./",
  build: {
    outDir: resolve(__dirname, "./build"),
    lib: {
      // The entry point for your library
      entry: resolve(__dirname, "./src/index.core.ts"),
      formats: ["es", "umd"],
      // The name of your library
      name: "@dgreenheck/three-pinata",
      // The file name formats for different module systems
      fileName: (format) => `three-pinata.core.${format}.js`,
    },
    minify: true,
    emptyOutDir: false,
  },
  plugins: [
    dts({
      entryRoot: "./src",
      rootDir: "./src",
      include: ["src/**/*"],
      outDir: "./build",
      rollupTypes: true,
      insertTypesEntry: true,
    }),
  ],
});
