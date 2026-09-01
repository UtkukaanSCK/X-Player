# Changelog

## Unreleased

- Quality has its own button on the control bar, showing the resolution actually
  playing, one click from the list. It covers HLS renditions and, through the new
  `sources` prop, several files of the same video. Subtitles and the chosen
  language survive a switch.
- The landing site moved to its own project. This repository is the player.
  `npm run dev` opens a development harness in `src/dev` instead.
- Audio tracks can be offered in the settings menu through `audioTracks`,
  `activeAudioTrack` and `onAudioTrack`. Controlled by the host: a file has to be
  demuxed to know a second language is in it, which is not the player's job.
- `apiRef` hands back `{ reload, seekTo, getVideo }`, for hosts that change what
  a source means without changing its URL — picking another audio track, say.
- `preloadHls()` fetches the HLS engine ahead of time, for a host that knows a
  stream is coming.
- The quality button now prefers the sources it was given over the renditions a
  stream declares, and stays hidden when a stream declares only one. A plain
  media playlist reports a single nameless rendition, and a menu whose only entry
  reads "Unknown" is worse than no menu.
- Menu rows no longer wrap onto two lines when a track name is long; the value
  shortens itself instead.
- X-Player Desktop, an Electron app built on this library, lives in its own
  project. It plays any file on disk by putting an ffmpeg gateway behind the same
  player, and adds no playback engine of its own.
- The seek bar now announces its position in words. It was reporting
  `aria-valuetext="1:05"`, which a screen reader reads out as digits; it now says
  "1 minute 5 seconds". `spokenTime` had been written for exactly this and was
  never wired up.
- Unit tests cover the time formatting and the state reducer, including the two
  faults that came out of it before: subtitles cleared by a quality switch, and
  actions that changed nothing returning a new object and driving a render loop.
- Continuous integration runs the type check, the linter, the unit tests, both
  builds and both end-to-end suites on every push.

## 1.0.0

First release.

### Player

- MP4, WebM and HLS playback, with a lazily loaded hls.js and a native HLS
  fallback on iOS.
- Stall guard: samples `currentTime` four times a second rather than trusting the
  `waiting` event, raises a spinner after 1.2 s of no progress and attempts
  silent recovery after six.
- Typed error recovery for fatal hls.js failures, with 0.5 s / 1.5 s / 4 s
  backoff on network errors before anything is shown to the viewer.
- Progress bar and time label painted directly to the DOM inside
  `requestAnimationFrame`, so the component does not re-render during playback.
- Adaptive quality menu, playback speed, WebVTT subtitles with a language picker,
  picture in picture, full screen, and resume-where-you-left-off.
- Full keyboard support, scoped to the player element so an embedded player never
  steals the host page's shortcuts.
- Defence layer against host page CSS, including rules marked `!important`.

### Distribution

- Single-file embed bundle at 20 kB gzipped, with React swapped for Preact and
  hls.js fetched at runtime only when an HLS source is opened.
- React library build with type declarations.
- SRI hashes generated at build time into `dist/embed/integrity.json`.

### Site

- Landing site with scroll-driven scenes, skipped entirely under
  `prefers-reduced-motion`.
- A live comparison section that shapes real bytes through a service worker so a
  visitor can drop the connection and watch a bare `<video>` and X-Player react
  side by side.
- Size figures generated from the build output rather than written by hand.
