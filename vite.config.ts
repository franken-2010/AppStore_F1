import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    sourcemap: false,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), '.'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
  },
});
