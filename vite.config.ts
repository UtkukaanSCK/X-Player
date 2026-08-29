import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Serves /downloads/* out of dist/ so the pages in examples/ resolve the same
 * paths in development that they will on a real site.
 */
function serveDistributables(): Plugin {
  return {
    name: 'x-player-serve-distributables',
    apply: 'serve',
    configureServer(server) {
      const root = resolve('dist')
      server.middlewares.use('/downloads', (req, res, next) => {
        const rel = (req.url ?? '').split('?')[0]
        const file = resolve(root, '.' + rel)
        if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return next()
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

/**
 * The development harness in src/dev. It is not shipped: the published artefacts
 * are the library and embed builds, which have their own configs.
 */
export default defineConfig({
  plugins: [react(), serveDistributables()],
  build: {
    outDir: 'dist/dev',
    emptyOutDir: true,
  },
})
