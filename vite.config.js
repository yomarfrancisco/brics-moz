import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/', // Ensure base path is root for Vercel
  build: {
    outDir: 'dist', // Default output directory
    assetsDir: 'assets', // Default assets directory
    minify: false, // Disable minification to make code more readable
    sourcemap: true, // Generate source maps for transparency
    rollupOptions: {
      external: [],
      output: {
        globals: {
          'crypto-js': 'CryptoJS'
        }
      }
    }
  },
  optimizeDeps: {
    include: ['crypto-js']
  },
  resolve: {
    alias: {
      'crypto-js': 'crypto-js'
    }
  }
});