import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: "src/chrome-extension/manifest.json", dest: "." },
        { src: "src/chrome-extension/public/logo.png", dest: "./public" },
      ],
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    open: "/popup-local.html",
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        options: resolve(__dirname, "options.html"),
        background: resolve(__dirname, "src/chrome-extension/background.js"),
        unicorn: resolve(
          __dirname,
          "src/chrome-extension/content-scripts/unicorn.ts"
        ),
        reserve: resolve(
          __dirname,
          "src/chrome-extension/content-scripts/reserve.ts"
        ),
        sothebys: resolve(
          __dirname,
          "src/chrome-extension/content-scripts/sothebys.ts"
        ),
        wine: resolve(
          __dirname,
          "src/chrome-extension/content-scripts/wine.ts"
        ),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (
            ["unicorn", "reserve", "sothebys", "wine"].includes(chunkInfo.name)
          ) {
            return "content-scripts/[name].js";
          }
          return chunkInfo.name === "background"
            ? "background.js"
            : "[name].js";
        },
      },
    },
  },
});
