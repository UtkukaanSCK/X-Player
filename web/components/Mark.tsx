/**
 * The app icon, drawn rather than fetched: an amber cross on a dark square.
 *
 * The square is its own token rather than ink. In dark, ink is near-white, and
 * an ink square there turned the mark light grey with amber on it - 1.68:1.
 * Classes rather than fill="var(...)", so that Tailwind is certain to emit the
 * variables they read.
 */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden focusable="false" className="flex-none">
      <rect width="22" height="22" rx="5.5" className="fill-mark-ground" />
      <path d="M7.5 7.5l7 7M14.5 7.5l-7 7" className="stroke-mark" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
