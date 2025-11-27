import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

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
    plugins,
    build: {
      outDir: "dist/public",
    },
  };
});
