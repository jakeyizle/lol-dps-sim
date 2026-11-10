import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages serves the app from /<repo>/.
export default defineConfig({
  base: "/lol-dps-sim/",
  plugins: [react(), tailwindcss()],
});
