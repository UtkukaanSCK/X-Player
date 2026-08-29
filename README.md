# X-Player

An embeddable web video player that survives bad networks. MP4, WebM and HLS, in
one script tag, with no build step.

- **20 kB gzipped** for the drop-in bundle, renderer and styles included
- **Streaming is optional weight** — `hls.min.js` is fetched only when an HLS
  source is actually opened, so a page that plays an MP4 never downloads it
- **Recovers on its own** — a stall guard watches whether playback is really
  advancing and retries with backoff, then explains itself in plain language and
  offers a way back if the connection is truly gone
- **Survives hostile CSS** — prefixed classes plus a defence layer that
  neutralises host resets, including rules using `!important`
- **Keyboard complete and labelled** — every control reachable, visible focus
  rings, and a static layout under `prefers-reduced-motion`

## Install

### 1. Plain HTML — one script tag

Copy `dist/embed/x-player.iife.js` (and `hls.min.js` alongside it, if you serve
HLS) into your site. Nothing else: React and the stylesheet are inside the file.

```html
<div id="player"></div>

<script src="/x-player.iife.js"></script>
<script>
  XPlayer.mount('#player', { src: '/video.mp4', title: 'Product tour' })
</script>
```

### 2. No code at all

The script mounts every `[data-x-player]` element on the page when it loads.

```html
<script src="/x-player.iife.js"></script>

<div data-x-player data-src="/video.mp4" data-title="Product tour"></div>
```

Attributes: `data-src` (required), `data-type`, `data-poster`, `data-title`,
`data-accent`, `data-autoplay`, `data-muted`, `data-loop`, `data-start`,
`data-remember`, `data-tracks` (a JSON array).

### 3. React

```bash
npm install github:UtkukaanSCK/x-player
```

```tsx
import { XPlayer } from 'x-player'
import 'x-player/style.css'

;<XPlayer src="/video.m3u8" title="Product tour" accent="#7dd3fc" />
```

`react` and `react-dom` are peer dependencies; `hls.js` is a real dependency and
is imported lazily.

### 4. CDN

jsDelivr serves tagged releases straight from GitHub, so nothing has to be
published to npm.

```html
<script
  src="https://cdn.jsdelivr.net/gh/UtkukaanSCK/x-player@v1.0.0/dist/embed/x-player.iife.js"
  crossorigin="anonymous"
></script>
```

`npm run build:embed` writes `dist/embed/integrity.json` with an SRI hash for
each file; add it as `integrity="sha384-…"` when you serve from a CDN.

## Props

| Prop | Default | What it does |
| --- | --- | --- |
| `src` | — | Video URL. A `.m3u8` is treated as HLS |
| `type` | `'auto'` | `'auto' \| 'hls' \| 'native'`, for when the extension lies |
| `poster` | — | Poster image |
| `title` | — | Shown top-left; with no title the bar is not rendered |
| `autoPlay` | `false` | If the browser blocks it, the play button appears — not an error |
| `muted` / `loop` | `false` | |
| `startTime` | `0` | Start position, in seconds |
| `accent` | `#7dd3fc` | Accent colour |
| `tracks` | `[]` | WebVTT subtitles: `{ src, label, srclang, default? }` |
| `rememberPosition` | `true` | Offer to resume where the viewer left off |
| `storageKey` | `src` | Key used to remember the position |
| `onReady` / `onPlay` / `onPause` / `onEnded` / `onError` | — | Events |

Theme through CSS variables instead of overriding classes: `--xp-accent`,
`--xp-fg`, `--xp-glass`, `--xp-glass-strong`, `--xp-hairline`, `--xp-radius`.

## Keyboard

| Key | Action |
| --- | --- |
| `Space` / `K` | Play or pause |
| `←` `→` | Skip 5 seconds |
| `J` / `L` | Skip 10 seconds |
| `↑` `↓` | Volume |
| `M` | Mute |
| `F` | Full screen |
| `I` | Picture in picture |
| `C` | Subtitles |
| `0`–`9` | Jump to percent |
| `<` `>` | Playback speed |

Shortcuts are bound to the player element, not the document, so an embedded
player never steals the host page's keys.

## How the resilience works

1. **Buffer settings** (`src/player/hooks/useVideoEngine.ts`) — 30 s of forward
   buffer, a 60 s ceiling, a 30 s back buffer so long videos do not leak memory,
   and a realistic starting bandwidth estimate, because an over-optimistic first
   guess makes playback stall immediately on startup.
2. **Stall guard** (`src/player/hooks/useStallGuard.ts`) — the `waiting` event is
   not trustworthy on its own: some stalls never fire it and some that do keep
   playing. So `currentTime` is sampled four times a second. No progress for
   1.2 s raises a spinner; six seconds triggers a silent recovery attempt, up to
   three times.
3. **Error recovery** — fatal hls.js errors are handled by type: media errors go
   to `recoverMediaError()`, network errors retry `startLoad()` after 0.5 s,
   1.5 s and 4 s. Only when all of that fails does the viewer see anything, and
   what they see is a sentence and a **Try again** button.
4. **The UI never janks** — the progress bar and time label are written straight
   to the DOM inside `requestAnimationFrame`, not through React state, so the
   component does not re-render during playback.
5. **Smooth scrubbing** — real seeks are throttled to about eight per second
   while dragging, or the browser drowns in seek requests.
6. **Spinner hysteresis** — appears after 250 ms, stays at least 400 ms, so brief
   hiccups never produce a flicker.

## Surviving the host page's CSS

Every class is prefixed `.xp-`, every variable `--xp-`, and there is no Tailwind.
On top of that, the defence layer at the top of `src/player/styles/player.css`
neutralises host rules targeting `button`, `input`, `svg`, `video` and `*`,
including ones marked `!important`.

`examples/embed-test.html` is a deliberately hostile page used to prove it, and
`scripts/e2e/embed.mjs` asserts each property individually.

This is not as absolute as Shadow DOM. A host page that targets some property not
on the defended list with `!important` can still get through; the fix in that
case is to add that property to the list.

## Development

```bash
npm install
npm run dev            # site at http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Landing site in dev mode |
| `npm run typecheck` | TypeScript |
| `npm run lint` | oxlint |
| `npm run build` | Landing site → `dist/site/` |
| `npm run build:lib` | React library + `.d.ts` → `dist/lib/` |
| `npm run build:embed` | Single-file embed bundle + SRI → `dist/embed/` |
| `npm run build:all` | All three, plus the measured size manifest |
| `npm run e2e` | Playwright suites against a running dev server |

### Tests

`npm run e2e` needs a server up (`npm run dev -- --port 5199`), or set
`BASE_URL`. Four suites:

| Suite | What it proves |
| --- | --- |
| `player` | Playback, seeking, keyboard, menus, HLS renditions, subtitles, no mobile overflow |
| `embed` | Bundle under 30 kB gzip, hls.js excluded and lazily fetched, no CSS leaks from a hostile host page |
| `netsim` | On a dropped connection the bare `<video>` dies while X-Player explains, offers retry, and resumes |
| `motion` | GSAP is never downloaded under `prefers-reduced-motion`, and nothing is left hidden |

The numbers shown on the landing site come from `scripts/measure-sizes.mjs`,
which measures the build output and writes `src/site/generated/sizes.json`. They
are not typed in by hand and cannot drift from what the repository ships.

## Browser support

Chrome, Edge, Firefox and Safari, current versions. HLS uses hls.js where
MediaSource exists and falls back to native HLS on iOS. Picture in picture is
feature-detected and its button is hidden where unsupported.

## Credits

The demo clip in `public/media/` is an excerpt from the **Sintel** trailer,
© Blender Foundation, used under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
See `public/media/CREDITS.md`. The HLS sample stream is provided by Mux.

## License

MIT — see [LICENSE](LICENSE).
