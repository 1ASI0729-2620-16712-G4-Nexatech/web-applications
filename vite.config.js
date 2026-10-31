import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// json-server Fake API used by the operational bounded contexts that are not yet in the RESTful API.
const proxy = {
  '/simulated-api/v1': {
    target: 'http://127.0.0.1:3000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/simulated-api\/v1/, '/api/v1'),
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: { manifest: 'asset-manifest.json' },
  server: { host: '127.0.0.1', proxy },
  preview: { host: '127.0.0.1', proxy },
});
