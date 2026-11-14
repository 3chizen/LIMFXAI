import { defineConfig } from 'vite';

export default defineConfig({
  configFile: false,
  publicDir: false,
  server: { proxy: { "/api": { target: "https://c291644f-limfxai-agent-engine.500ccshikazukiru.workers.dev", changeOrigin: true, secure: true } } },
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
