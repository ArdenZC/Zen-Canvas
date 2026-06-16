import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  define: {
    __BUNDLED_DEV__: "false",
    __SERVER_FORWARD_CONSOLE__: "false"
  },
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true
  }
});
