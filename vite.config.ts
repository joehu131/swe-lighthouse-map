import { defineConfig } from 'vite';

export default defineConfig({
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
