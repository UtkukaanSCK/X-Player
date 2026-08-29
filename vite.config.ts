import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const OUT_DIR = 'dist/site'

/**
 * Copies the built library and embed bundles into the site output, so the
 * download links and the copy-paste <script> snippets on the page resolve
 * against the site itself rather than a CDN that may not exist yet.
 */
function copyDistributables(): Plugin {
  return {
    name: 'x-player-copy-distributables',
    apply: 'build',
    closeBundle() {
      for (const dir of ['embed', 'lib']) {
        const from = resolve(`dist/${dir}`)
        if (!existsSync(from)) {
          this.warn(`dist/${dir} not found - run build:lib and build:embed first`)
          continue
        }
        const to = resolve(OUT_DIR, 'downloads', dir)
        mkdirSync(to, { recursive: true })
        cpSync(from, to, { recursive: true })
      }
    },
  }
}

/**
 * In dev, serve /downloads/* straight out of dist/ so the example pages and the
 * site's own download links resolve to the same paths they will have in
 * production. Without this the examples only work after a full build.
 */
function serveDistributablesInDev(): Plugin {
  return {
    name: 'x-player-serve-distributables',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/downloads', (req, res, next) => {
        const rel = (req.url ?? '').split('?')[0]
        // Keep this strictly inside dist/: no traversal out of the directory.
        const file = resolve('dist', '.' + rel)
        if (!file.startsWith(resolve('dist')) || !existsSync(file) || !statSync(file).isFile()) return next()
        const type = file.endsWith('.js')
          ? 'text/javascript'
          : file.endsWith('.css')
            ? 'text/css'
            : file.endsWith('.json')
              ? 'application/json'
              : 'application/octet-stream'
        res.setHeader('Content-Type', type)
        res.end(readFileSync(file))
      })
    },
  }
}

// The landing site. The library and embed bundles have their own configs.
export default defineConfig({
  plugins: [react(), serveDistributablesInDev(), copyDistributables()],
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
  },
})
