import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Triajji',
      fileName: () => 'widget.js',
      formats: ['iife'],
    },
    rollupOptions: {
      // Bundle everything — no externals
      // Host page cannot be assumed to have React
    },
    cssCodeSplit: false,
    sourcemap: true,
    minify: 'terser',
    outDir: 'dist',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
