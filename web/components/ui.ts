/**
 * The page's controls, written once.
 *
 * Every button and link style lives here so that a primary action cannot
 * drift between sections. All of it is tokens, so light and dark are both
 * exact; focus is an ink ring in both, near-black in light and near-white in
 * dark.
 */

export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
/** For a control flush with a clipping edge, where an outside ring would be cut away. */
export const FOCUS_INSET = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink'

const BTN = `inline-flex items-center justify-center gap-2 rounded-full text-body font-medium transition-colors duration-150 disabled:opacity-50 ${FOCUS}`
/* In forced colours the fill is dropped, so the border is what keeps a pill visible. */
const FILL = 'bg-ink text-on-ink hover:bg-ink-hover active:bg-ink-press forced-colors:border forced-colors:border-[ButtonText]'

/** The one filled action in a group: the download for the visitor's own platform. */
export const PRIMARY = `${BTN} min-h-11 px-5 ${FILL}`
/** A section's main action: View on GitHub, Play the comparison, Go to the page. */
export const PRIMARY_LG = `${BTN} min-h-12 px-6 ${FILL}`
/** Every other action. The edge is `control`, the 3:1 a control's only boundary needs. */
export const SECONDARY = `${BTN} min-h-11 px-5 border border-control text-ink hover:bg-ink/5 active:bg-ink/10`
export const TEXT_LINK = `inline-flex min-h-11 items-center rounded-sm text-caption text-muted underline decoration-control decoration-1 underline-offset-4 transition-colors duration-150 hover:text-ink hover:decoration-ink ${FOCUS}`
