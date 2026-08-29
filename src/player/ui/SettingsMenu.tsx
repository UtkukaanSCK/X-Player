import { useEffect, useState } from 'react'
import type { PlayerState } from '../types'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, SettingsIcon } from './Icons'
import { useMenu } from './useMenu'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

interface Props {
  state: PlayerState
  onRate: (rate: number) => void
  onTextTrack: (index: number) => void
  onOpenChange: (open: boolean) => void
}

type Panel = 'main' | 'speed' | 'subtitles'

/**
 * Speed and subtitles. Quality used to live here too, but it has its own button
 * on the bar now: it is the setting people reach for when playback is
 * struggling, and it should not take two clicks to find.
 */
export function SettingsMenu({ state, onRate, onTextTrack, onOpenChange }: Props) {
  const { open, setOpen, wrapRef, buttonRef } = useMenu(onOpenChange)
  const [panel, setPanel] = useState<Panel>('main')

  useEffect(() => {
    if (!open) setPanel('main')
  }, [open])

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
        onClick={() => setOpen(!open)}
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
                <span>{panel === 'speed' ? 'Playback speed' : 'Subtitles'}</span>
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
