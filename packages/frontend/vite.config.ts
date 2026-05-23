import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig(({ mode }) => ({
  plugins: [
    TanStackRouterVite({ routesDirectory: './src/routes' }),
    react(),
  ],
  base: mode === 'desktop' ? './' : '/',
  build: {
    outDir: mode === 'desktop' ? '../desktop/dist/frontend' : 'dist',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
}));
