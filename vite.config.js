import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const proxy = { '/api/v1': { target: 'http://127.0.0.1:3000', changeOrigin: true } };

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: { manifest: 'asset-manifest.json' },
  server: { host: '127.0.0.1', proxy },
  preview: { host: '127.0.0.1', proxy },
});
