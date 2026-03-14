import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3005,
    open: true,
  },
  preview: {
    port: 3005,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  envPrefix: 'SHORTCUT_',
});
