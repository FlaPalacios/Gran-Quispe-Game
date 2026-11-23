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
  // En desarrollo con el servidor online corriendo aparte (npm run server), la conexión
  // de los celulares pasa por Vite hasta él
  server: {
    proxy: { '/socket.io': { target: 'http://localhost:3000', ws: true } },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'server/**/*.test.js'],
    passWithNoTests: true,
  },
});
