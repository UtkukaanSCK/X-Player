import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

import { SITE_NAME } from '@/lib/site'

/**
 * The card other sites show when someone pastes a link.
 *
 * Rendered at build time into a static PNG, so it costs nothing at runtime and
 * works on a host that only serves files. It says the same thing the page says,
 * in the same palette, rather than being a logo on a gradient.
 */
// Static export renders this once at build time rather than on request.
export const dynamic = 'force-static'

export const alt = 'X-Player — a plain video element and X-Player on the same throttled connection'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const MARK = '#ffb020'
const INK = '#17171a'
const MUTED = '#5e5e66'
const LINE = '#e4e4e7'
const PANEL = '#f5f5f6'

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

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#ffffff',
          padding: 72,
          fontFamily: 'Archivo',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/*
            Two crossed bars rather than the ✕ character. Satori has to fetch a
            font for any glyph it meets, and the fetch for that one failed at
            build time, leaving a tofu box in the card. Drawn shapes need no
            font and cannot fail.
          */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              background: INK,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: 22,
                height: 4.5,
                borderRadius: 3,
                background: MARK,
                transform: 'rotate(45deg)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: 22,
                height: 4.5,
                borderRadius: 3,
                background: MARK,
                transform: 'rotate(-45deg)',
              }}
            />
          </div>
          <div style={{ color: INK, fontSize: 28, fontWeight: 700, letterSpacing: -0.3 }}>{SITE_NAME}</div>
        </div>

        {/* Two lines set by hand, in one colour, as the page's heading wraps at this width. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            color: INK,
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -2,
            lineHeight: 1.05,
          }}
        >
          <div>A bad connection,</div>
          <div>shown rather than described.</div>
        </div>

        {/* Two panels, because the page is a comparison and the card should say so. */}
        <div style={{ display: 'flex', gap: 16 }}>
          {['A plain <video>', 'X-Player'].map((name) => (
            <div
              key={name}
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'space-between',
                padding: '18px 22px',
                borderRadius: 12,
                background: PANEL,
                border: `1px solid ${LINE}`,
                color: INK,
                fontSize: 22,
              }}
            >
              <span>{name}</span>
              <span style={{ color: MUTED }}>stalled</span>
            </div>
          ))}
        </div>
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
