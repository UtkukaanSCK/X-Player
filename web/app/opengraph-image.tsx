import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

import { SITE_NAME } from '@/lib/site'

/**
 * The card other sites show when someone pastes a link.
 *
 * Rendered at build time into a static PNG, so it costs nothing at runtime and
 * works on a host that only serves files. It says the same thing the page says,
 * in the page's light palette, rather than being a logo on a gradient: the
 * mark and the name, the heading, and the two players as black frames that run
 * off the bottom edge.
 */
// Static export renders this once at build time rather than on request.
export const dynamic = 'force-static'

export const alt = 'X-Player — a plain video element and X-Player on the same throttled connection'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Satori reads no CSS variables, so the page's tokens are repeated here as values.
const GROUND = '#ffffff'
const INK = '#17171a'
const MARK = '#ffb020'
const MARK_GROUND = '#17171a'
const FRAME = '#000000'

/*
 * The page's own typeface, read from the repository at build time.
 *
 * Without it Satori falls back to a face of its own, which did not match the
 * page, ignored the bold weight, and measured "rather" wide enough to leave a
 * gap before "than" that no layout change could close. next/font's files are
 * WOFF2, which Satori cannot read, so these are the static TrueType cuts from
 * Google Fonts, kept with their licence in assets/fonts.
 */
const [regular, bold] = await Promise.all([
  readFile(join(process.cwd(), 'assets/fonts/Archivo-Regular.ttf')),
  readFile(join(process.cwd(), 'assets/fonts/Archivo-Bold.ttf')),
])

const PAD = 72
const FRAME_W = 516
const FRAME_H = 290
const FRAME_TOP = 400

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: GROUND,
          fontFamily: 'Archivo',
        }}
      >
        <div style={{ position: 'absolute', top: 64, left: PAD, display: 'flex', alignItems: 'center', gap: 16 }}>
          {/*
            Two crossed bars rather than the ✕ character. Satori has to fetch a
            font for any glyph it meets, and the fetch for that one failed at
            build time, leaving a tofu box in the card. Drawn shapes need no
            font and cannot fail.
          */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: MARK_GROUND,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {[45, -45].map((angle) => (
              <div
                key={angle}
                style={{
                  position: 'absolute',
                  width: 24,
                  height: 5,
                  borderRadius: 3,
                  background: MARK,
                  transform: `rotate(${angle}deg)`,
                }}
              />
            ))}
          </div>
          <div style={{ color: INK, fontSize: 30, fontWeight: 700, letterSpacing: -0.4 }}>{SITE_NAME}</div>
        </div>

        {/* Two lines set by hand, in one colour, as the page's heading wraps at this width. */}
        <div
          style={{
            position: 'absolute',
            top: 156,
            left: PAD,
            display: 'flex',
            flexDirection: 'column',
            color: INK,
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -2.3,
            lineHeight: '76px',
          }}
        >
          <div>X-Player, on a</div>
          <div>throttled connection.</div>
        </div>

        {/*
          Two frames, because the page is a comparison and the card should say
          so. The buffers are filled to the same 30% in both: the page claims
          the two do equally badly on this link, and the card must not claim
          otherwise.
        */}
        {[
          { name: 'A plain <video>', fill: 'rgba(255,255,255,0.9)' },
          { name: 'X-Player', fill: MARK },
        ].map((frame, index) => (
          <div
            key={frame.name}
            style={{
              position: 'absolute',
              top: FRAME_TOP,
              left: PAD + index * (FRAME_W + 24),
              width: FRAME_W,
              height: FRAME_H,
              display: 'flex',
              flexDirection: 'column',
              padding: '22px 26px',
              borderRadius: 20,
              background: FRAME,
              boxShadow: '0 24px 48px -28px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ color: '#ffffff', fontSize: 24, fontWeight: 400 }}>{frame.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: 22, fontWeight: 400 }}>stalled</span>
            </div>
            <div
              style={{
                position: 'absolute',
                top: 92,
                left: 26,
                right: 26,
                height: 4,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.22)',
                display: 'flex',
              }}
            >
              <div style={{ width: '30%', height: '100%', borderRadius: 2, background: frame.fill }} />
            </div>
          </div>
        ))}
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Archivo', data: regular, style: 'normal', weight: 400 },
        { name: 'Archivo', data: bold, style: 'normal', weight: 700 },
      ],
    },
  )
}
