import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "../site/lib",
    emptyOutDir: false,
    chunkSizeWarningLimit: 3000,
    lib: {
      entry: "src/main.tsx",
      name: "Carte3D",
      formats: ["iife"],
      fileName: () => "carte3d.js",
    },
  },
});
