import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/swe-lighthouse-map/' : './',
  server: {
    port: 5173,
    open: false,
  },
  assetsInclude: ['**/*.wgsl'],
  test: {
    environment: 'node',
    globals: true,
  },
});
