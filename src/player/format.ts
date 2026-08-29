/** Formats seconds as 1:05 / 1:02:03. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const total = Math.floor(seconds)
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Readable duration for screen readers, e.g. "3 minutes 5 seconds". */
export function spokenTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const parts: string[] = []
  if (h) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`)
  if (m) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`)
  parts.push(`${s} ${s === 1 ? 'second' : 'seconds'}`)
  return parts.join(' ')
}
