import type { NextConfig } from 'next'

import { normalizeBasePath } from './lib/base-path'

/*
 * GitHub Pages serves a project repository from /<repo>/, so the export has to
 * be told the prefix at build time. Empty for a domain root, which is what a
 * user site or a custom domain would be - the workflow works it out from the
 * repository name rather than having it written down in two places.
 */
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)

const config: NextConfig = {
  // The page is entirely static: no server, no revalidation, nothing to run.
  // It can be dropped on any host, which is what a landing page should need.
  output: 'export',

  ...(basePath ? { basePath } : {}),

  turbopack: {
    /*
     * The player is a sibling checkout, copied into vendor/ by
     * scripts/sync-player.mjs rather than linked.
     *
     * A `file:..` dependency would be the obvious way to do this, and it was:
     * npm installs it as a symlink to the folder above, which contains this
     * one, and Turbopack walks it until it gives up. Aliasing a copy inside the
     * project keeps every path this build touches underneath the project root.
     */
    // Relative, not absolute: Turbopack rejects a Windows absolute path here
    // with "windows imports are not implemented yet".
    resolveAlias: {
      'x-player/style.css': './vendor/x-player/style.css',
      'x-player': './vendor/x-player/x-player.es.js',
    },
  },

  images: { unoptimized: true },
  reactStrictMode: true,
}

export default config
