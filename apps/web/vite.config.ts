import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      '@doom-like/engine': path.resolve(__dirname, '../../packages/engine/src'),
      '@doom-like/game-logic': path.resolve(__dirname, '../../packages/game-logic/src'),
      '@doom-like/map-editor': path.resolve(__dirname, '../../packages/map-editor/src'),
      '@doom-like/assets': path.resolve(__dirname, '../../packages/assets/src'),
    },
  },

  server: {
    port: 5173,
    headers: {
      // COOP/COEP for SharedArrayBuffer and WebGPU
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'babylonjs-core': ['@babylonjs/core'],
          'babylonjs-materials': ['@babylonjs/materials'],
          'babylonjs-loaders': ['@babylonjs/loaders'],
          'babylonjs-gui': ['@babylonjs/gui'],
        },
      },
    },
  },

  optimizeDeps: {
    include: [
      '@babylonjs/core',
      '@babylonjs/materials', 
      '@babylonjs/loaders',
      '@babylonjs/gui',
    ],
  },
});