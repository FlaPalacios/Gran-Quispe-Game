import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas para poder publicar en cualquier hosting estático
  base: './',
  build: {
    outDir: 'dist',
    // Phaser pesa ~1 MB; se separa en su propio chunk
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    passWithNoTests: true,
  },
});
