import { useEffect, useRef, useState } from 'react'
import type { PlayerState, XPlayerSource } from '../types'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, SettingsIcon } from './Icons'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

interface Props {
  state: PlayerState
  /** Progressive renditions, when the caller supplied several. */
  sources: XPlayerSource[]
  onRate: (rate: number) => void
  onLevel: (level: number) => void
  onSource: (index: number) => void
  onTextTrack: (index: number) => void
  onOpenChange: (open: boolean) => void
}

type Panel = 'main' | 'speed' | 'quality' | 'subtitles'

export function SettingsMenu({ state, sources, onRate, onLevel, onSource, onTextTrack, onOpenChange }: Props) {
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<Panel>('main')
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    onOpenChange(open)
    if (!open) setPanel('main')
  }, [open, onOpenChange])

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onDown, true)
    // On the document, not the wrapper: picking an option unmounts the button
    // that had focus, and a wrapper listener would never hear the key again.
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const hasLevels = state.levels.length > 0
  const hasSources = sources.length > 1

  const activeLevelLabel = (() => {
    if (hasLevels) {
      if (state.selectedLevel === -1) {
        const active = state.levels.find((l) => l.id === state.activeLevel)
        return active ? `Auto (${active.label})` : 'Auto'
      }
      return state.levels.find((l) => l.id === state.selectedLevel)?.label ?? 'Auto'
    }
    if (hasSources) return sources[state.activeSource]?.label ?? sources[0].label
    return null
  })()

  const subtitleLabel =
    state.activeTextTrack === -1 ? 'Off' : (state.textTracks[state.activeTextTrack]?.label ?? 'Off')

  return (
    <div className="xp-settings" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`xp-btn${open ? ' xp-btn-active' : ''}`}
        aria-label="Settings"
        aria-haspopup="menu"
        aria-expanded={open}
        data-xp-tip="Settings"
        onClick={() => setOpen((v) => !v)}
      >
        <SettingsIcon />
      </button>

      {open && (
        <div className="xp-menu" role="menu">
          {panel === 'main' && (
            <div className="xp-menu-panel">
              <button type="button" className="xp-menu-item" role="menuitem" onClick={() => setPanel('speed')}>
                <span>Playback speed</span>
                <span className="xp-menu-value">
                  {state.rate === 1 ? 'Normal' : `${state.rate}x`} <ChevronRightIcon />
                </span>
              </button>
              {activeLevelLabel && (
                <button type="button" className="xp-menu-item" role="menuitem" onClick={() => setPanel('quality')}>
                  <span>Quality</span>
                  <span className="xp-menu-value">
                    {activeLevelLabel} <ChevronRightIcon />
                  </span>
                </button>
              )}
              {state.textTracks.length > 0 && (
                <button type="button" className="xp-menu-item" role="menuitem" onClick={() => setPanel('subtitles')}>
                  <span>Subtitles</span>
                  <span className="xp-menu-value">
                    {subtitleLabel} <ChevronRightIcon />
                  </span>
                </button>
              )}
            </div>
          )}

          {panel !== 'main' && (
            <div className="xp-menu-panel">
              <button type="button" className="xp-menu-back" onClick={() => setPanel('main')}>
                <ChevronLeftIcon />
                <span>
                  {panel === 'speed' ? 'Playback speed' : panel === 'quality' ? 'Quality' : 'Subtitles'}
                </span>
              </button>

              {panel === 'speed' &&
                RATES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="xp-menu-item xp-menu-option"
                    role="menuitemradio"
                    aria-checked={state.rate === r}
                    onClick={() => {
                      onRate(r)
                      setPanel('main')
                    }}
                  >
                    <span className="xp-menu-check">{state.rate === r && <CheckIcon />}</span>
                    <span>{r === 1 ? 'Normal' : `${r}x`}</span>
                  </button>
                ))}

              {panel === 'quality' && hasLevels && (
                <>
                  <button
                    type="button"
                    className="xp-menu-item xp-menu-option"
                    role="menuitemradio"
                    aria-checked={state.selectedLevel === -1}
                    onClick={() => {
                      onLevel(-1)
                      setPanel('main')
                    }}
                  >
                    <span className="xp-menu-check">{state.selectedLevel === -1 && <CheckIcon />}</span>
                    <span>Auto</span>
                  </button>
                  {state.levels.map((lv) => (
                    <button
                      key={lv.id}
                      type="button"
                      className="xp-menu-item xp-menu-option"
                      role="menuitemradio"
                      aria-checked={state.selectedLevel === lv.id}
                      onClick={() => {
                        onLevel(lv.id)
                        setPanel('main')
                      }}
                    >
                      <span className="xp-menu-check">{state.selectedLevel === lv.id && <CheckIcon />}</span>
                      <span>{lv.label}</span>
                    </button>
                  ))}
                </>
              )}

              {panel === 'quality' && !hasLevels && hasSources && (
                <>
                  {sources.map((source, i) => (
                    <button
                      key={source.src}
                      type="button"
                      className="xp-menu-item xp-menu-option"
                      role="menuitemradio"
                      aria-checked={state.activeSource === i}
                      onClick={() => {
                        onSource(i)
                        setPanel('main')
                      }}
                    >
                      <span className="xp-menu-check">{state.activeSource === i && <CheckIcon />}</span>
                      <span>{source.label}</span>
                    </button>
                  ))}
                </>
              )}

              {panel === 'subtitles' && (
                <>
                  <button
                    type="button"
                    className="xp-menu-item xp-menu-option"
                    role="menuitemradio"
                    aria-checked={state.activeTextTrack === -1}
                    onClick={() => {
                      onTextTrack(-1)
                      setPanel('main')
                    }}
                  >
                    <span className="xp-menu-check">{state.activeTextTrack === -1 && <CheckIcon />}</span>
                    <span>Off</span>
                  </button>
                  {state.textTracks.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      className="xp-menu-item xp-menu-option"
                      role="menuitemradio"
                      aria-checked={state.activeTextTrack === i}
                      onClick={() => {
                        onTextTrack(i)
                        setPanel('main')
                      }}
                    >
                      <span className="xp-menu-check">{state.activeTextTrack === i && <CheckIcon />}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
