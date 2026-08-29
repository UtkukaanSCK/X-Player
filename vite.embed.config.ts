import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const require = createRequire(import.meta.url)
const OUT_DIR = 'dist/embed'

/**
 * Inlines the stylesheet into the JS bundle and injects it as a <style> tag at
 * runtime, so embedding takes exactly one <script> tag and nothing else.
 */
function inlineCss(): Plugin {
  return {
    name: 'x-player-inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      let css = ''
      for (const [file, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'asset' && file.endsWith('.css')) {
          css += String(chunk.source)
          delete bundle[file]
        }
      }
      if (!css) return
      const injector =
        `(function(){try{if(typeof document==='undefined')return;` +
        `if(document.getElementById('x-player-styles'))return;` +
        `var s=document.createElement('style');s.id='x-player-styles';` +
        `s.textContent=${JSON.stringify(css)};document.head.appendChild(s);}catch(e){}})();\n`
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          chunk.code = injector + chunk.code
        }
      }
    },
  }
}

/**
 * Drops hls.min.js next to the embed bundle. The runtime loader looks for it
 * there first, so a self-hosted install never has to reach a CDN.
 */
function copyHls(): Plugin {
  return {
    name: 'x-player-copy-hls',
    apply: 'build',
    closeBundle() {
      const from = require.resolve('hls.js/dist/hls.min.js')
      mkdirSync(OUT_DIR, { recursive: true })
      copyFileSync(from, resolve(OUT_DIR, 'hls.min.js'))
    },
  }
}

/**
 * Redirects every `load-hls` import to `load-hls.embed`. An alias entry cannot do
 * this: aliases match the import specifier ("../load-hls"), not the file it
 * resolves to, so the swap has to happen after resolution.
 */
function swapHlsLoader(): Plugin {
  return {
    name: 'x-player-swap-hls-loader',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!/(^|[\\/])load-hls(\.ts)?$/.test(source)) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (!resolved || resolved.id.includes('load-hls.embed')) return null
      return resolved.id.replace(/load-hls\.ts$/, 'load-hls.embed.ts')
    },
  }
}

/**
 * The single-file embed build.
 *
 *   <script src="x-player.iife.js"></script>
 *   <script>XPlayer.mount('#el', { src: '...' })</script>
 *
 * Two things keep this file small. React is swapped for Preact, which is
 * API-compatible for what the player uses and roughly a tenth of the size. And
 * hls.js is not bundled at all: `load-hls.ts` is replaced with a variant that
 * fetches hls.min.js at runtime, only when an HLS source is actually opened.
 * The library build (vite.lib.config.ts) keeps real React and a lazy import.
 */
export default defineConfig({
  plugins: [swapHlsLoader(), react(), inlineCss(), copyHls()],
  publicDir: false,
  resolve: {
    alias: {
      'react/jsx-runtime': 'preact/jsx-runtime',
      'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
      'react-dom/client': 'preact/compat/client',
      'react-dom/test-utils': 'preact/test-utils',
      'react-dom': 'preact/compat',
      react: 'preact/compat',
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, 'src/embed.ts'),
      name: 'XPlayer',
      formats: ['iife'],
      fileName: () => 'x-player.iife.js',
    },
  },
})
