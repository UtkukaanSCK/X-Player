import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { XPlayer } from './player/XPlayer'
import type { XPlayerProps, XPlayerTrack } from './player/types'

const roots = new WeakMap<Element, Root>()

export interface PlayerHandle {
  /** Ayarları değiştirip yeniden çizer. */
  update: (options: Partial<XPlayerProps>) => void
  /** Oynatıcıyı sayfadan kaldırır. */
  destroy: () => void
  element: Element
}

function resolveElement(target: string | Element): Element {
  const el = typeof target === 'string' ? document.querySelector(target) : target
  if (!el) throw new Error(`X-Player: "${String(target)}" bulunamadı.`)
  return el
}

/**
 * Oynatıcıyı bir elemana yerleştirir.
 *   XPlayer.mount('#player', { src: 'video.mp4', title: 'Tanıtım' })
 */
export function mount(target: string | Element, options: XPlayerProps): PlayerHandle {
  const el = resolveElement(target)
  let root = roots.get(el)
  if (!root) {
    root = createRoot(el)
    roots.set(el, root)
  }
  let current = options
  root.render(createElement(XPlayer, current))

  return {
    element: el,
    update(next) {
      current = { ...current, ...next }
      root.render(createElement(XPlayer, current))
    },
    destroy() {
      root.unmount()
      roots.delete(el)
    },
  }
}

function parseTracks(raw: string | undefined): XPlayerTrack[] | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as XPlayerTrack[]) : undefined
  } catch {
    console.warn('X-Player: data-tracks geçerli JSON değil, yok sayıldı.')
    return undefined
  }
}

function optionsFromDataset(el: HTMLElement): XPlayerProps | null {
  const src = el.dataset.src
  if (!src) {
    console.warn('X-Player: data-x-player öğesinde data-src yok.', el)
    return null
  }
  return {
    src,
    type: (el.dataset.type as XPlayerProps['type']) || 'auto',
    poster: el.dataset.poster,
    title: el.dataset.title,
    accent: el.dataset.accent,
    autoPlay: el.dataset.autoplay === 'true',
    muted: el.dataset.muted === 'true',
    loop: el.dataset.loop === 'true',
    startTime: el.dataset.start ? Number(el.dataset.start) : 0,
    rememberPosition: el.dataset.remember !== 'false',
    tracks: parseTracks(el.dataset.tracks),
  }
}

/**
 * Sayfadaki tüm `[data-x-player]` öğelerini otomatik kurar.
 * Script yüklendiğinde kendiliğinden bir kez çalışır.
 */
export function autoMount(scope: ParentNode = document): PlayerHandle[] {
  const handles: PlayerHandle[] = []
  scope.querySelectorAll<HTMLElement>('[data-x-player]').forEach((el) => {
    if (el.dataset.xPlayerMounted === 'true') return
    const options = optionsFromDataset(el)
    if (!options) return
    el.dataset.xPlayerMounted = 'true'
    handles.push(mount(el, options))
  })
  return handles
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => autoMount(), { once: true })
  } else {
    autoMount()
  }
}

export { XPlayer }
export type { XPlayerProps, XPlayerTrack }
