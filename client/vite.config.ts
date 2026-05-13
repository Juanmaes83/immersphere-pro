import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/three/') || id.includes('\\three\\')) return 'vendor-three';
          if (id.includes('@sparkjsdev')) return 'vendor-spark';
          if (id.includes('/playcanvas/') || id.includes('\\playcanvas\\')) return 'vendor-playcanvas';
          if (id.includes('/leaflet/') || id.includes('\\leaflet\\') || id.includes('react-leaflet')) return 'vendor-leaflet';
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  }
});
