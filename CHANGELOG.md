# Changelog

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
