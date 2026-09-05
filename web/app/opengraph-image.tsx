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

const AMBER = '#ffb020'
const PAPER = '#f2f0eb'
const MUTED = '#8d8f96'
const LINE = '#26282d'
const PANEL = '#131417'

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
          background: '#0b0b0d',
          padding: 64,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/*
            Two crossed bars rather than the ✕ character. Satori has to fetch a
            font for any glyph it meets, and the fetch for that one failed at
            build time, leaving a tofu box in the card. Drawn shapes need no
            font and cannot fail.
          */}
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 9,
              background: PANEL,
              border: `1px solid ${LINE}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: 20,
                height: 3.5,
                borderRadius: 2,
                background: AMBER,
                transform: 'rotate(45deg)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: 20,
                height: 3.5,
                borderRadius: 2,
                background: AMBER,
                transform: 'rotate(-45deg)',
              }}
            />
          </div>
          <div style={{ color: PAPER, fontSize: 26, fontWeight: 600, letterSpacing: -0.4 }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ color: PAPER, fontSize: 78, fontWeight: 700, letterSpacing: -2.6, lineHeight: 1.02 }}>
            A bad connection,
          </div>
          <div style={{ color: MUTED, fontSize: 78, fontWeight: 700, letterSpacing: -2.6, lineHeight: 1.02 }}>
            shown rather than described.
          </div>
        </div>

        {/* Two panels, because the page is a comparison and the card should say so. */}
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { name: 'A plain <video>', tone: MUTED },
            { name: 'X-Player', tone: AMBER },
          ].map((panel) => (
            <div
              key={panel.name}
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderRadius: 10,
                background: PANEL,
                border: `1px solid ${LINE}`,
                color: panel.tone,
                fontSize: 22,
              }}
            >
              <span>{panel.name}</span>
              <span style={{ color: MUTED }}>stalled</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  )
}
