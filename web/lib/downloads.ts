import { withBase } from '@/lib/site'

import sizes from './generated/sizes.json'

/**
 * What the wizard can actually hand over.
 *
 * Every weight here is measured by `scripts/sync-player.mjs` from the copies
 * that are served, so a number on the page cannot drift from the file behind
 * the link. Nothing is typed in.
 */

export type Use = 'watch' | 'embed'
export type Target = 'html' | 'react' | 'cdn'
export type Playing = 'files' | 'stream'

export interface Asset {
  name: string
  /** Absent when there is nothing to fetch. */
  href?: string
  /** Where it has to end up for the setup to work. */
  place: string
  what: string
  raw: number
  gzip: number
  /** True when the browser fetches it only at the moment it is needed. */
  lazy?: boolean
}

export const CDN_BASE = 'https://cdn.jsdelivr.net/gh/UtkukaanSCK/X-Player@v1.0.0/dist/embed'

export const MEASURED_AT = sizes.measuredAt

const FILES = {
  embed: withBase('/downloads/embed/x-player.iife.js'),
  hls: withBase('/downloads/embed/hls.min.js'),
  libJs: withBase('/downloads/lib/x-player.es.js'),
  libCss: withBase('/downloads/lib/style.css'),
} as const

export function assetsFor(target: Target, playing: Playing): Asset[] {
  const streaming = playing === 'stream'

  if (target === 'html') {
    const list: Asset[] = [
      {
        name: 'x-player.iife.js',
        href: FILES.embed,
        place: 'Anywhere your page can link to',
        what: 'The player, its renderer and its styles in one file. No build step, no stylesheet to remember.',
        raw: sizes.embed.raw,
        gzip: sizes.embed.gzip,
      },
    ]
    if (streaming) {
      list.push({
        name: 'hls.min.js',
        href: FILES.hls,
        place: 'Beside the file above',
        what: 'The streaming engine. The player looks for it next to itself and loads it the first time an HLS source opens — never before.',
        raw: sizes.hls.raw,
        gzip: sizes.hls.gzip,
        lazy: true,
      })
    }
    return list
  }

  if (target === 'react') {
    const list: Asset[] = [
      {
        name: 'x-player.es.js',
        href: FILES.libJs,
        place: 'Imported by your app',
        what: 'The ES module. React and react-dom stay yours — they are peer dependencies, not copies.',
        raw: sizes.libJs.raw,
        gzip: sizes.libJs.gzip,
      },
      {
        name: 'style.css',
        href: FILES.libCss,
        place: 'Imported once, anywhere',
        what: 'The stylesheet, kept separate so your bundler can put it wherever it puts the rest.',
        raw: sizes.libCss.raw,
        gzip: sizes.libCss.gzip,
      },
    ]
    if (streaming) {
      list.push({
        name: 'hls.js',
        place: 'Nothing to fetch',
        what: 'Comes with the package as its one runtime dependency, imported lazily, so your bundler emits a chunk nobody downloads until a stream opens.',
        raw: sizes.hls.raw,
        gzip: sizes.hls.gzip,
        lazy: true,
      })
    }
    return list
  }

  const list: Asset[] = [
    {
      name: 'x-player.iife.js',
      href: `${CDN_BASE}/x-player.iife.js`,
      place: 'Served by jsDelivr',
      what: 'Nothing to host. Pin it with the integrity hash the build prints and the browser refuses anything that is not byte for byte this file.',
      raw: sizes.embed.raw,
      gzip: sizes.embed.gzip,
    },
  ]
  if (streaming) {
    list.push({
      name: 'hls.min.js',
      href: `${CDN_BASE}/hls.min.js`,
      place: 'Served by jsDelivr',
      what: 'Found automatically beside the file above, and pinned the same way.',
      raw: sizes.hls.raw,
      gzip: sizes.hls.gzip,
      lazy: true,
    })
  }
  return list
}

export const SNIPPETS: Record<Target, { label: string; code: string; note: string }> = {
  html: {
    label: 'Then, in your page',
    code: `<div id="player"></div>

<script src="/x-player.iife.js"></script>
<script>
  XPlayer.mount('#player', {
    src: '/video.mp4',
    title: 'Product tour'
  })
</script>`,
    note: 'No build step. The renderer and the styles are inside the one file you just took.',
  },
  react: {
    label: 'Then, in your component',
    code: `import { XPlayer } from 'x-player'
import 'x-player/style.css'

<XPlayer src="/video.m3u8" title="Product tour" accent="#ffb020" />`,
    note: 'react and react-dom stay yours. hls.js is imported lazily, so it lands in its own chunk.',
  },
  cdn: {
    label: 'Then, in your page',
    code: `<div id="player"></div>

<script src="${CDN_BASE}/x-player.iife.js"
        crossorigin="anonymous"></script>
<script>
  XPlayer.mount('#player', { src: '/video.mp4' })
</script>`,
    note: 'Nothing to host. Add the integrity attribute from the build to pin the exact file.',
  },
}
