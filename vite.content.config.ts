import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  publicDir: false,
  build: {
    outDir: resolve(projectRoot, "dist"),
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(projectRoot, "src/content/bootstrap.ts"),
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "content.js",
      },
    },
  },
});
