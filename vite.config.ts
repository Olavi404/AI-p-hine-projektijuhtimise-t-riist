import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "API_PORT");
  return {
    root: "client",
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT || env.API_PORT || 3001}` },
    },
    build: { outDir: "../dist", emptyOutDir: true },
  };
});
