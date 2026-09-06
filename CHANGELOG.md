# Changelog

## Unreleased

- The player does far less while it plays. The seek bar was rewriting
  `aria-valuenow` and `aria-valuetext` sixty times a second for a value that
  changes once, telling assistive technology the slider had moved when it had
  not; it now writes when the second changes. Dragging the bar cost one React
  render per pointer move and now costs none. The stall guard no longer wakes
  four times a second on a player nobody has pressed play on, and moving the
  pointer over the video no longer rebuilds the hide timer on every frame.
- The seek bar told screen readers two different times for the same instant:
  the number rounded while the words and the visible clock floored, so at 0.84s
  it read "1" and said "0 seconds". All three now agree.
- Internals only: XPlayer is 321 lines rather than 730, with media events,
  commands, subtitles, gestures and painting each in a hook of their own. The
  public API is unchanged. The library is about 700 bytes of gzip larger for
  it - module boundaries are not free, and the decomposition is worth saying
  out loud rather than only its benefits.
- Quality has its own button on the control bar, showing the resolution actually
  playing, one click from the list. It covers HLS renditions and, through the new
  `sources` prop, several files of the same video. Subtitles and the chosen
  language survive a switch.
- The landing site moved to its own project. This repository is the player.
  `npm run dev` opens a development harness in `src/dev` instead.
- Audio tracks can be offered in the settings menu through `audioTracks`,
  `activeAudioTrack` and `onAudioTrack`. Controlled by the host: a file has to be
  demuxed to know a second language is in it, which is not the player's job. When
  `activeAudioTrack` matches nothing in the list the row stays blank rather than
  naming the first track, which the panel would then decline to tick.
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
  never wired up. Both spoken and numeric values settle a non-finite duration
  first: a live stream reports `Infinity`, and `Infinity % 60` is `NaN`, so
  scrubbing one used to announce "Infinity hours NaN seconds".
- Unit tests cover the time formatting and the state reducer, including the two
  faults that came out of it before: subtitles cleared by a quality switch, and
  actions that changed nothing returning a new object and driving a render loop.
- Continuous integration runs the type check, the linter, the unit tests, both
  builds and both end-to-end suites on every push. It installs with
  `--ignore-scripts`, or the `prepare` script builds the library during install
  and every push pays for three builds instead of one.
- Stall recovery no longer blanks the picture. On a progressive source it nudged
  the playhead forward whenever playback stopped, including when the buffer was
  simply empty - which cleared the frame and got nothing back, because the bytes
  it was seeking towards were not there. It now only nudges when there is data
  ahead to nudge into, so a starved player holds its last frame the way a bare
  video element does.
- The interface is English throughout. Two toasts still spoke Turkish - seeking
  said `+10 sn`, the volume said `Ses %60` - and so did the embed API: the error
  thrown for a missing mount target, the two `console.warn` calls about a bad
  `data-tracks` or a missing `data-src`, and the doc comments on `PlayerHandle`.
- A long file name no longer covers the picture. The title had nothing stopping
  it, so a release-group name wrapped to three or four lines behind its gradient.
- The resume position survives being paused. The save was skipped whenever the
  video was paused, which was right for the periodic save and wrong for the same
  function used on unmount and on `pagehide` - the two moments it matters most.
  Pausing, seeking and closing lost the seek. It is also saved on
  `visibilitychange`: a phone that backgrounds the tab and then has it reclaimed
  never fires `pagehide`, which is exactly where playback gets interrupted. A
  live stream no longer has a position written for it, and no longer has one
  offered either - `Infinity` is truthy, so the read path had been letting
  through positions the write path would now refuse to record.
- The controls no longer fade out from under the keyboard, leaving the focused
  control invisible and unreachable behind `pointer-events: none`. Every path
  that hides now checks focus, not just the pointer-leave one: leaving the
  player is always preceded by a pointer move, which re-arms the hide timer, so
  guarding one path alone only delayed the same disappearance by 2.5 seconds.
  The container carries `tabIndex={0}` and collects focus from any click that
  lands on nothing focusable, so it is excluded - counting it would have held
  the bar open for the whole of an ordinary click to play.
- Returning to a settings sub-panel puts focus on its back button rather than
  partway down the option list. The button had no `role`, which also made it an
  invalid child of `role="menu"`; it is a `menuitem` now, which fixes both.
- Dismissing a menu by clicking elsewhere on the page no longer pulls focus back
  onto the settings button. Closing unmounts the focused item, and the resulting
  `focusout` looks exactly like focus falling out of a menu that is staying
  open - on an embedded player, that meant stealing focus from the host page.
- Playback errors are announced. The message was a bare paragraph, so the one
  moment a screen-reader user most needs telling was the one moment nothing was
  said.
- Choosing an option in a menu no longer drops focus to the document. The click
  unmounts the button that had focus, and the next Tab restarted from the top of
  the page rather than from the menu.

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
