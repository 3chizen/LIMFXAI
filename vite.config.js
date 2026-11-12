import { defineConfig } from 'vite';

export default defineConfig({
  configFile: false,
  publicDir: false,
  build: {
    outDir: 'public',
    emptyOutDir: false,
    minify: true,
    rollupOptions: {
      input: 'src/wallet-connect.js',
      output: {
        entryFileNames: 'wallet-connect.bundle.js',
        chunkFileNames: 'wallet-chunks/[name]-[hash].js',
        assetFileNames: 'wallet-assets/[name]-[hash][extname]'
      }
    }
  }
});
