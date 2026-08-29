import { useEffect, type RefObject } from 'react'

export interface PlayerCommands {
  togglePlay: () => void
  seekBy: (delta: number) => void
  seekToRatio: (ratio: number) => void
  nudgeVolume: (delta: number) => void
  toggleMute: () => void
  toggleFullscreen: () => void
  togglePip: () => void
  cycleSubtitles: () => void
  nudgeRate: (dir: 1 | -1) => void
}

/**
 * Listens on the container rather than the document, so an embedded player
 * never steals the host page's keyboard shortcuts.
 */
export function useKeyboard(
  containerRef: RefObject<HTMLElement | null>,
  commandsRef: RefObject<PlayerCommands>,
  onActivity: () => void,
) {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onKeyDown = (e: KeyboardEvent) => {
      // Stay out of the way while the viewer is typing.
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
        // The volume slider is an input too; leave the arrow keys to it.
        if (target.tagName !== 'INPUT' || (target as HTMLInputElement).type !== 'range') return
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') return
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return

      const c = commandsRef.current
      let handled = true

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          c.togglePlay()
          break
        case 'ArrowLeft':
          c.seekBy(-5)
          break
        case 'ArrowRight':
          c.seekBy(5)
          break
        case 'j':
        case 'J':
          c.seekBy(-10)
          break
        case 'l':
        case 'L':
          c.seekBy(10)
          break
        case 'ArrowUp':
          c.nudgeVolume(0.05)
          break
        case 'ArrowDown':
          c.nudgeVolume(-0.05)
          break
        case 'm':
        case 'M':
          c.toggleMute()
          break
        case 'f':
        case 'F':
          c.toggleFullscreen()
          break
        case 'i':
        case 'I':
          c.togglePip()
          break
        case 'c':
        case 'C':
          c.cycleSubtitles()
          break
        case '>':
        case '.':
          c.nudgeRate(1)
          break
        case '<':
        case ',':
          c.nudgeRate(-1)
          break
        case 'Home':
          c.seekToRatio(0)
          break
        case 'End':
          c.seekToRatio(0.999)
          break
        default:
          if (/^[0-9]$/.test(e.key)) c.seekToRatio(Number(e.key) / 10)
          else handled = false
      }

      if (handled) {
        e.preventDefault()
        e.stopPropagation()
        onActivity()
      }
    }

    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [containerRef, commandsRef, onActivity])
}
