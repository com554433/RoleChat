import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  esbuild: {
    loader: 'tsx',
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'chrome114',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          zustand: ['zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  }
})
