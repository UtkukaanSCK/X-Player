# X-Player site

Two sections. The first is a comparison you can drive; the second is a link to
the repository. Next.js and Tailwind, exported as a static site.

```bash
npm install
npm run dev        # http://localhost:5175
npm run build      # static export into out/
npm run serve      # serve out/ the way a host would, on :5199
npm run e2e        # needs a server up; point BASE_URL at either
```

The player is copied in from the sibling checkout by `scripts/sync-player.mjs`,
which `dev`, `build` and `typecheck` all run first. Build the player before
running any of them.

It is a copy rather than a link on purpose. An `x-player: file:..` dependency is
the obvious way to do it, and npm installs that as a symlink from
`node_modules/x-player` to the folder above - which contains this one. Anything
walking node_modules then descends into itself forever, and Turbopack eventually
says so and dies:

```
'web/node_modules/x-player' is a symlink causes that causes an infinite loop!
```

Copying keeps every path this build touches underneath the project root.

## The comparison

A plain `<video>` and X-Player, side by side, playing the same file over the
same connection. A service worker in front of `/media/` throttles the bytes, and
scrolling through the section is what degrades it: full speed, then a starved
link.

Reloading starts the page over from the top rather than resuming where you were,
because the first section is a demonstration that runs as you scroll and being
dropped into the middle of one means arriving at an ending with no beginning.

Everything about it is real, and several attempts at it were not:

- **Both players are throttled identically**, per response, at the same rate. A
  single shared budget models one connection better and was tried first, but it
  is first-come-first-served, so whichever player queued its chunks first took
  the pipe. It measured 4.0 seconds to 0.0 in our favour, which is the worst way
  for a demonstration to be wrong. Fairness beats realism here.
- **Nothing loads until the worker is in control.** A media element fetches the
  file as one long-lived response, and a response that started before the worker
  claimed the page never passes through it - which is how both players once
  ended up with the whole clip buffered and every throttle setting doing nothing.
- **Nothing is remounted.** The connection degrades underneath players that are
  already running. Restarting them on each change meant the plain video was
  handed a starved link from byte zero, never gathered enough to begin, and sat
  at 0:00 looking far worse than it deserved.
- **"Normal" is throttled too**, to 70 kB/s. Served from localhost the whole clip
  arrives in about a second, and two players holding the entire file cannot
  demonstrate anything about a connection.

### What it actually shows

Measured, not assumed: **on these two settings, nothing separates them.** Both
crawl at the same rate and both show they are waiting. The page says so rather
than implying otherwise, because anyone can check by watching the two panels for
ten seconds.

There used to be a third setting that cut the connection outright, and that was
where they parted: the plain video stopped on a frame with nothing to press,
while X-Player explained itself and offered a retry that resumed within a second
of where it stopped. That setting was removed on request. What remains is an
honest demonstration of what a bad connection does, not of one player beating
another.

## The wizard

Section 02 asks what you are doing and hands over exactly that. Two audiences
want opposite things — a folder of films wants an installer, a website wants the
smallest file that plays video — and asking is shorter than explaining both.

The library branch subtracts rather than adds. Choose MP4 and the 184 kB
streaming engine is absent from the list entirely, because a page that never
opens a stream never fetches it. That is the most interesting thing about this
player and it only shows if the page takes things away.

Every file it offers is real: `scripts/sync-player.mjs` copies the player's
build into `public/downloads/` and measures those exact bytes into
`lib/generated/sizes.json`. The suite downloads each one and fails if it is
missing or does not weigh what the page claims.

## Releasing the desktop app

Section 02 offers the desktop build, and it is driven entirely from
`lib/releases.ts` so it can never advertise a file that does not exist.

Nothing is published yet. The app builds and the Windows installer has been
produced and run, but there is no release, so the section says that and points
at the source instead of showing buttons that would 404.

To turn it into a real download:

1. Create `UtkukaanSCK/X-Player-App` and push the app there.
2. Run `npm run dist` on each platform you intend to support — there is no
   cross-building, because ffmpeg is staged from the machine doing the build.
3. Publish a release tagged `v<version>` with the artefacts named in
   `lib/releases.ts`.
4. Set `published: true`, correct the sizes, and set `verified` for any platform
   you have actually launched the build on.

The suite guards the one thing this section must never do: when `published` is
false it fails if any link points at a release asset. A download button that
404s is worse than no download section, and nothing else on the page would
reveal it.

## The three sections

The proof, the app and the source are three separate `<section>` elements with
their own anchors and their own scroll listeners, and are not meant to look like
it. Nothing marks the boundary -
no rule, no gap, no change of ground - and the comparison scrolls away while the
next block rises to meet it, so the two read as one movement.

Two earlier attempts at that are worth not repeating. Overlapping the sections
with a negative margin shortened the document by a viewport and left no scroll
range after the handover, so the second section never got past 57% opacity.
Scrubbing a scroll target that sits inside a sticky container gave readings that
climbed and then fell again, because a pinned element stops moving and progress
derived from its box stops meaning anything.

## The clip

`public/media/demo-long.mp4` is the brightest three seconds of the Sintel
excerpt, looped to two minutes. Both decisions were forced:

- Two minutes, because a short clip is fully buffered before the connection can
  be taken away.
- The bright window, because the source fades to black for whole seconds, and a
  comparison of two players is worthless when both panels are showing black.

## Suites

| Suite | What it proves |
| --- | --- |
| `proof` | The throttle bites, neither player is favoured, the plain video dies with nothing to press, X-Player explains itself and resumes, and the second section links to the repository |
| `motion` | Scroll drives the connection and not just the visuals, nothing transforms under `prefers-reduced-motion`, and both typefaces load |
| `wizard` | The second branch subtracts, every offered file downloads and weighs what the page claims, and nothing is offered before a release exists |
| `access` | The accessibility guarantees, measured on the rendered page rather than asserted |
| `deploy` | Content types, cache behaviour, the link card, the canonical URL, a working 404, and the build's weight |

### What `access` measures

It is the suite that keeps the AA claim honest, so it computes rather than
trusts. Contrast is taken from the colour the browser actually painted and the
colour actually behind it, not from the token values — a token is only as good
as the surface it lands on, and `bg-good/10` over `bg-panel` is neither.

The rest are the failures that a design review reads straight past:

- **One h1, no skipped levels.** The comparison is client-only, so the heading
  lives outside it in `ProofHeading`; without that the exported HTML had no h1
  at all and the first heading in the document was the wizard's h2.
- **A focus tour.** It tabs the page and fails on anything it can reach but not
  see. Both lower sections fade in on scroll, and an element at `opacity: 0` is
  still in the tab order.
- **One tab stop per radiogroup**, which is what the role promises.
- **Landmarks**: one `main`, a `contentinfo` that is not nested inside it, and
  no unnamed `section`.
- **No text cut off** at 390, 768, 1024 and 1440 — overflow that is hidden with
  no ellipsis to show for it, which is words silently gone.


## Deploying

The build is a static export: `out/` is a folder of files with no server behind
it, so any host will do.

```bash
npm run build
BASE_URL=http://localhost:5199 npm run e2e   # against out/, with npm run serve up
```

Run the suites against the exported build, not just the dev server. Three of the
things that break in production are invisible before it: a link card served as a
binary download, a demo clip answered from cache so the throttle has nothing to
throttle, and a 404 that never renders.

### GitHub Pages

This is where the site is published. `.github/workflows/deploy-pages.yml` in the
repository root builds the player, then the site, then uploads `web/out`. Turn it
on once in **Settings → Pages → Source → GitHub Actions**; after that a push to
`main` touching `web/` or `src/` publishes.

Three things are different from a host that lets you set headers, and all three
are handled rather than tolerated:

| | |
| --- | --- |
| **Jekyll** | Pages runs it by default and drops every path starting with an underscore, which is where Next puts all of its bundles. `public/.nojekyll` turns it off, and the workflow fails if that file is missing from the export rather than publishing a site whose every asset 404s |
| **Base path** | A project repository is served from `/<repo>/`, not from the root. The workflow derives the prefix from the repository name - empty for a `<owner>.github.io` repository, `/<repo>` otherwise - and passes it as `NEXT_PUBLIC_BASE_PATH`. Next prefixes its own bundles; anything the page addresses by hand goes through `withBase()` in `lib/site.ts` |
| **Headers** | Pages sets its own and they cannot be overridden, so the `no-store` rule below is unavailable. It is not needed: the service worker fetches the clip with `cache: 'no-store'`, which goes past the HTTP cache whatever the host said. `e2e/deploy.mjs` checks for that bypass rather than for the header |

The service worker is the part that basePath breaks most quietly. Its scope
cannot reach above its own path, so a registration asking for `/` from
`/X-Player/` fails outright, and its match for what to throttle has to be
scope-relative or the throttle passes every request through untouched - two
identical videos beside a caption insisting one of them is struggling. Both are
derived from `self.registration.scope` rather than written down.

To check it locally, serve the export the shape Pages will:

```bash
NEXT_PUBLIC_BASE_PATH=X-Player npm run build
mkdir -p /tmp/pages/X-Player && cp -r out/. /tmp/pages/X-Player/
SERVE_ROOT=/tmp/pages npm run serve
BASE_URL=http://localhost:5199/X-Player npm run e2e
```

`scripts/serve-out.mjs` redirects a directory requested without its trailing
slash, which is what Pages does and which the service worker scope depends on.

### Vercel

`vercel.json` is kept for it: build command, output directory, security headers
and cache rules. Import the repository and it needs no further configuration.
Nothing in it applies on Pages, which ignores the file; it is the record of what
a host that accepts headers should be told.

Set `NEXT_PUBLIC_SITE_URL` to the real domain. Everything absolute - the
canonical link, the sitemap, the Open Graph card - is derived from it, and it
defaults to the GitHub Pages address below.

### Anywhere else

Serve `out/` as a static directory. Two rules matter and both are in
`vercel.json` for reference:

| Path | Rule | Why |
| --- | --- | --- |
| `/media/*` | `Cache-Control: no-store` | A cached clip is delivered without touching the network, so the throttling would apply to nothing and the page would insist it had slowed a connection it never used |
| `/x-player-netsim-sw.js` | `max-age=0, must-revalidate` | A stale service worker keeps intercepting requests with old rules long after the site is updated |

The Open Graph card is emitted twice: once as Next's extensionless
`opengraph-image`, and once as `og.png` by `scripts/postbuild.mjs`, which also
repoints the meta tags at it. Hosts that guess content types from extensions
serve the extensionless one as a download and every link preview silently falls
back to plain text.

### What the deploy suite checks

`e2e/deploy.mjs` asserts the things that fail quietly: every asset served with
the right content type, the clip never marked immutable and the worker fetching
it past the HTTP cache, an absolute card URL, a canonical link, a working 404, no
unreferenced video shipped, and a build whose weight is the clip rather than
accident.

It runs against whichever layout you point `BASE_URL` at, so the same suite
covers a root deployment and a Pages one under `/<repo>/`.
