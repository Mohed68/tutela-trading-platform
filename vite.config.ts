import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "client",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./client/src", import.meta.url)),
      "@assets": fileURLToPath(new URL("./attached_assets", import.meta.url)),
    },
  },
  build: {
    outDir: "../dist/public",
  },
});
