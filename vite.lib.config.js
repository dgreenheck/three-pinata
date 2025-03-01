import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    copyPublicDir: false,
    lib: {
      // The entry point for your library
      entry: resolve(__dirname, "src/lib/index.ts"),
      formats: ["es", "umd"],
      // The name of your library
      name: "three-pinata",
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
    },
    sourcemap: true,
    // Reduce bloat in the output
    minify: "esbuild",
  },
  plugins: [
    // Generate .d.ts files
    dts({
      include: ['src/lib/**/*'],  // Only include types from src/lib
      exclude: ['src/demo/**/*', 'public'], // Explicitly exclude demo code
      insertTypesEntry: true,
    }),
  ],
});