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
- **Quality on the bar, not buried** — a button showing what is actually playing,
  one click from the list. HLS renditions, or several files you supply

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
npm install github:UtkukaanSCK/X-Player
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
  src="https://cdn.jsdelivr.net/gh/UtkukaanSCK/X-Player@v1.0.0/dist/embed/x-player.iife.js"
  crossorigin="anonymous"
></script>
```

`npm run build:embed` writes `dist/embed/integrity.json` with an SRI hash for
each file; add it as `integrity="sha384-…"` when you serve from a CDN.

## Props

| Prop | Default | What it does |
| --- | --- | --- |
| `src` | — | Video URL. A `.m3u8` is treated as HLS. Optional when `sources` is given |
| `sources` | — | Several encodes of the same video: `{ src, label }[]`. Puts a quality button on the control bar for plain MP4 and WebM, and keeps your place when you switch |
| `type` | `'auto'` | `'auto' \| 'hls' \| 'native'`, for when the extension lies |
| `poster` | — | Poster image |
| `title` | — | Shown top-left; with no title the bar is not rendered |
| `autoPlay` | `false` | If the browser blocks it, the play button appears — not an error |
| `muted` / `loop` | `false` | |
| `startTime` | `0` | Start position, in seconds |
| `accent` | `#7dd3fc` | Accent colour |
| `tracks` | `[]` | WebVTT subtitles: `{ src, label, srclang, default? }` |
| `audioTracks` | `[]` | Selectable audio tracks: `{ id, label, language? }`. The player shows the list and reports the choice; carrying it out is the host's job, because a file has to be demuxed to know a second language is in there |
| `activeAudioTrack` | `-1` | Id of the track in use |
| `onAudioTrack` | — | Called with the id the viewer picked |
| `apiRef` | — | Receives `{ reload, seekTo, getVideo }`, for hosts that change what a source means without changing its URL |
| `rememberPosition` | `true` | Offer to resume where the viewer left off |
| `storageKey` | `src` | Key used to remember the position |
| `onReady` / `onPlay` / `onPause` / `onEnded` / `onError` | — | Events |

`preloadHls()` is also exported: it fetches the HLS engine ahead of time, for a
page that already knows a stream is coming and would rather not spend the beat
when it arrives.

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
npm run dev            # development harness at http://localhost:5173
```

`src/dev` is a plain harness, not a demo site: one block per case worth checking
by hand (the quality ladder, an HLS stream, a single file, your own video). It is
deliberately unstyled, so a visual problem is obviously the player's and not the
page's around it. It is never published; the artefacts are the two builds below.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development harness |
| `npm run typecheck` | TypeScript |
| `npm run lint` | oxlint |
| `npm run build` | Library and embed bundles |
| `npm run build:lib` | React library + `.d.ts` → `dist/lib/` |
| `npm run build:embed` | Single-file embed bundle + SRI → `dist/embed/` |
| `npm run e2e` | Playwright suites against a running dev server |

### Tests

`npm test` runs the unit tests: the time formatting, and the state reducer with
both of the faults it once had pinned in place.

`npm run e2e` needs `npm run dev` up, or set `BASE_URL`. Two suites:

| Suite | What it proves |
| --- | --- |
| `player` | Playback, seeking, keyboard, menus, the quality button for both a progressive ladder and HLS renditions, subtitles surviving a quality switch, no mobile overflow |
| `embed` | Bundle under 30 kB gzip, hls.js excluded and lazily fetched, no CSS leaks from a deliberately hostile host page |

### Projects built on this one

Two things consume this library and live in their own projects, so the
repository stays a library:

- **The landing site**, which demonstrates all of the above.
- **X-Player Desktop**, an Electron app that plays any file on disk - MKV, AVI,
  HEVC, DTS and the rest - by putting an ffmpeg gateway behind the same player.
  It adds no playback engine of its own: the gateway turns every file into
  either a plain MP4 or an HLS stream, both of which the player already knows.

Both consume X-Player the way anyone else would.

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
