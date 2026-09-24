import { realpathSync } from "node:fs";
import { configDefaults, defineConfig } from "vitest/config";
import { searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const workspaceRoot = searchForWorkspaceRoot(process.cwd());
const dependencyRoot = realpathSync("node_modules");

export default defineConfig({
  base: "./",
  define: {
    __BUNDLED_DEV__: "false",
    __SERVER_FORWARD_CONSOLE__: "false"
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [workspaceRoot, dependencyRoot]
    }
  },
  test: {
    exclude: [
      ...configDefaults.exclude,
      "**/.tmp-tests/**",
      "**/.tmp-performance-fixtures/**",
      "**/.performance-artifacts/**",
      "**/.performance-cache/**",
      "**/.performance-temp/**"
    ]
  }
});
