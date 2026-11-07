import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Compilación de alojamiento estático aislada de producción:
 * - solo importa pantallas con cálculos locales;
 * - no carga Firebase/AuthContext/Gemini;
 * - los assets se sirven bajo el subdirectorio gratuito de GitHub Pages.
 */
export default defineConfig({
  root: path.resolve(process.cwd(), 'preview'),
  base: '/AppStore_F1/',
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: {'@': path.resolve(process.cwd(), '.')},
    dedupe: ['react','react-dom'],
  },
  build: {
    outDir: path.resolve(process.cwd(), 'dist-preview'),
    emptyOutDir: true,
    sourcemap: false,
  },
});
