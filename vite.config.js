import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'web',
  // Relative base so the build works on GitHub Pages, Vercel or a file:// open.
  base: './',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../dist', emptyOutDir: true },
  // src/planner.js is shared with the CLI and lives outside the Vite root.
  server: { fs: { allow: ['..'] } },
});
