import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative assets so it works effortlessly on Cloudflare Pages root or subpaths
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: false,
  }
});
