/**
 * Generate vite.config.ts for exported project
 */

export const generateViteConfig = (): string => `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    react(),
    // Gzip compression
    compression({
      algorithm: 'gzip',
      ext: '.gz',
    }),
    // Brotli compression (better ratio)
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
  ],
  base: './',
  build: {
    // Enable minification with terser for better compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
    // Disable sourcemaps in production for smaller bundle
    sourcemap: false,
    // Target modern browsers for smaller bundle
    target: 'es2020',
  },
})
`;
