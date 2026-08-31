import { loadHls } from './load-hls'

/**
 * Fetches the HLS engine before it is needed.
 *
 * The player loads it the moment it meets an HLS source, which costs a beat on
 * the first stream a page or an app plays. A host that already knows a stream
 * is coming can spend that beat earlier, while nobody is waiting for anything.
 *
 * Safe to call as often as you like: the module is cached after the first call,
 * and a failure here is not an error - the player will simply load it the
 * ordinary way, and report the problem then if there is one.
 */
export function preloadHls(): void {
  void loadHls().catch(() => {})
}
