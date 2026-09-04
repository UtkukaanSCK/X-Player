import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Draws the favicon and the Apple touch icon.
 *
 * Generated rather than dropped in as binaries so the mark is reproducible from
 * source and stays in step with the palette. Drawn by measuring each pixel's
 * distance to the shape, which anti-aliases without a rasteriser and keeps the
 * X legible at 32 pixels, where an exported SVG usually turns to mush.
 */
const GROUND = [0x0b, 0x0b, 0x0d]
const AMBER = [0xff, 0xb0, 0x20]

const distanceToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

const distanceToRoundedRect = (px, py, halfW, halfH, radius) => {
  const qx = Math.abs(px) - halfW + radius
  const qy = Math.abs(py) - halfH + radius
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
}

const coverage = (distance) => Math.max(0, Math.min(1, 0.5 - distance))

function render(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const centre = size / 2
  const radius = size * 0.234
  const inset = size * 0.285
  const strokeHalf = size * 0.058

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const inShape = coverage(distanceToRoundedRect(px - centre, py - centre, centre, centre, radius))
      const onStroke = Math.max(
        coverage(distanceToSegment(px, py, inset, inset, size - inset, size - inset) - strokeHalf),
        coverage(distanceToSegment(px, py, size - inset, inset, inset, size - inset) - strokeHalf),
      )
      const at = (y * size + x) * 4
      for (let c = 0; c < 3; c++) pixels[at + c] = Math.round(GROUND[c] * (1 - onStroke) + AMBER[c] * onStroke)
      pixels[at + 3] = Math.round(inShape * 255)
    }
  }
  return pixels
}

/* ------------------------------------------------------------------ encoding */

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(pixels, size) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // truecolour with alpha

  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Next picks these up by filename: app/icon.png and app/apple-icon.png.
const OUT = join(import.meta.dirname, '../app')
for (const [name, size] of [
  ['icon.png', 512],
  ['apple-icon.png', 180],
]) {
  const png = encodePng(render(size), size)
  writeFileSync(join(OUT, name), png)
  console.log(`app/${name}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB`)
}
