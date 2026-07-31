import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: 'hidden',
    target: 'es2019',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
        },
      },
    },
  },
  esbuild: {
    target: 'es2019',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2019',
    },
  },
  server: {
    host: true,
    port: 5174,
    strictPort: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['@testing-library/jest-dom/vitest'],
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths()
  ],
})
