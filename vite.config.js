import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'web',
  // Relative by default, which works on a domain root and on file://. GitHub
  // Pages serves from /<repo>/, and a relative base breaks there the moment a
  // URL lacks its trailing slash — so the Pages workflow passes an absolute one.
  base: process.env.VITE_BASE ?? './',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../dist', emptyOutDir: true },
  // src/planner.js is shared with the CLI and lives outside the Vite root.
  server: { fs: { allow: ['..'] } },
});
