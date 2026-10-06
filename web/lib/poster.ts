import { withBase } from './site'

/**
 * The still both players show before they start, and the one the placeholder
 * shows in their place.
 *
 * Its own module so the placeholder can have it without importing the
 * comparison, which is loaded on the client only and would be pulled into the
 * first bundle by the import. One path, so the frame the placeholder draws is
 * the frame the players open on, and the browser fetches it once.
 */
export const POSTER = withBase('/media/demo.jpg')
