import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async ({ mode }) => {
  const isProduction = mode === "production";

  const plugins = [
    react(),
    ...(isProduction
      ? []
      : [
          (await import("@replit/vite-plugin-cartographer")).default({
            template: "react-ts",
            entry: "/src/main.tsx",
            ignoredRouteFiles: [
              "**/routes/**",
              "**/components/**",
              "**/__tests__/**",
              "src/main.tsx",
            ],
          }),
        ]),
  ];

  return {
    root: "client",
    plugins,
    resolve: {
      alias: {
        "@": "/workspace/tutela-trading-platform/client/src",
        "@assets": "/workspace/tutela-trading-platform/attached_assets",
        "react-router-dom": "/workspace/tutela-trading-platform/client/src/lib/router",
      },
    },
    build: {
      outDir: "../dist/public",
    },
  };
});
