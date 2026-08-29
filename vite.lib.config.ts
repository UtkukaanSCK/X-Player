import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Kütüphane derlemesi: React projelerinde `import { XPlayer } from 'x-player'`.
 * React ve hls.js dışarıda bırakılır — tüketici uygulama kendi kopyasını kullanır.
 */
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'dist/lib',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'XPlayer',
      formats: ['es', 'cjs'],
      fileName: (format) => `x-player.${format}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'hls.js'],
      output: {
        exports: 'named',
        assetFileNames: 'style.css',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'hls.js': 'Hls',
        },
      },
    },
  },
})
