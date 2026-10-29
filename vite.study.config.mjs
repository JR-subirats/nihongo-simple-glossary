import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./src/study", import.meta.url)),
  base: "./",
  plugins: [vue()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  build: {
    outDir: fileURLToPath(new URL("./dist/study", import.meta.url)),
    emptyOutDir: true,
  },
});
