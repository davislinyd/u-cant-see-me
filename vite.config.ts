import { existsSync, readFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

interface ExtensionManifest {
  [key: string]: unknown;
}

function emitExtensionManifest(): Plugin {
  return {
    name: "emit-extension-manifest",
    generateBundle() {
      const manifestPath = resolve(projectRoot, "manifest.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ExtensionManifest;
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      });

    },
    writeBundle(options) {
      const outputDir = options.dir ?? projectRoot;
      for (const [sourceSuffix, targetName] of [
        ["src/ui/popup/popup.html", "popup.html"],
        ["src/ui/options/options.html", "options.html"],
      ] as const) {
        const sourcePath = resolve(outputDir, sourceSuffix);
        const targetPath = resolve(outputDir, targetName);
        if (existsSync(sourcePath)) {
          renameSync(sourcePath, targetPath);
        }
      }
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [emitExtensionManifest()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        "service-worker": resolve(projectRoot, "src/background/service-worker.ts"),
        content: resolve(projectRoot, "src/content/bootstrap.ts"),
        popup: resolve(projectRoot, "src/ui/popup/popup.html"),
        options: resolve(projectRoot, "src/ui/options/options.html"),
      },
      output: {
        format: "es",
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
