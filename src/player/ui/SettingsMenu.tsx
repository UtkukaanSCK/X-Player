import { useEffect, useState } from 'react'
import type { PlayerState, XPlayerAudioTrack } from '../types'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, SettingsIcon } from './Icons'
import { useMenu } from './useMenu'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

interface Props {
  state: PlayerState
  audioTracks: XPlayerAudioTrack[]
  activeAudioTrack: number
  onRate: (rate: number) => void
  onTextTrack: (index: number) => void
  onAudioTrack: (id: number) => void
  onOpenChange: (open: boolean) => void
}

type Panel = 'main' | 'speed' | 'subtitles' | 'audio'

const PANEL_TITLE: Record<Exclude<Panel, 'main'>, string> = {
  speed: 'Playback speed',
  subtitles: 'Subtitles',
  audio: 'Audio track',
}

/**
 * Speed, subtitles and the audio track. Quality used to live here too, but it
 * has its own button on the bar now: it is the setting people reach for when
 * playback is struggling, and it should not take two clicks to find.
 *
 * The audio row only appears when there is genuinely more than one track. A
 * menu entry that always says "Track 1" teaches people to ignore the menu.
 */
export function SettingsMenu({
  state,
  audioTracks,
  activeAudioTrack,
  onRate,
  onTextTrack,
  onAudioTrack,
  onOpenChange,
}: Props) {
  const { open, setOpen, wrapRef, buttonRef } = useMenu(onOpenChange)
  const [panel, setPanel] = useState<Panel>('main')

  useEffect(() => {
    if (!open) setPanel('main')
  }, [open])

  const subtitleLabel =
    state.activeTextTrack === -1 ? 'Off' : (state.textTracks[state.activeTextTrack]?.label ?? 'Off')
  // No fallback to the first track: the panel ticks the row whose id matches,
  // so naming a track here that the panel would not tick makes the closed row
  // claim a selection that does not exist. Empty is the honest answer.
  const audioLabel = audioTracks.find((t) => t.id === activeAudioTrack)?.label ?? ''

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
                  <span>{state.rate === 1 ? 'Normal' : `${state.rate}x`}</span> <ChevronRightIcon />
                </span>
              </button>
              {state.textTracks.length > 0 && (
                <button type="button" className="xp-menu-item" role="menuitem" onClick={() => setPanel('subtitles')}>
                  <span>Subtitles</span>
                  <span className="xp-menu-value">
                    <span>{subtitleLabel}</span> <ChevronRightIcon />
                  </span>
                </button>
              )}
              {audioTracks.length > 1 && (
                <button type="button" className="xp-menu-item" role="menuitem" onClick={() => setPanel('audio')}>
                  <span>Audio track</span>
                  <span className="xp-menu-value">
                    <span>{audioLabel}</span> <ChevronRightIcon />
                  </span>
                </button>
              )}
            </div>
          )}

          {panel !== 'main' && (
            <div className="xp-menu-panel">
              {/* role="menuitem" does two things: it makes this the first stop
                  when focus returns to a sub-panel, instead of landing on an
                  option halfway down the list, and it keeps the ARIA valid -
                  a role-less button is not a permitted child of role="menu". */}
              <button
                type="button"
                className="xp-menu-back"
                role="menuitem"
                onClick={() => setPanel('main')}
              >
                <ChevronLeftIcon />
                <span>{PANEL_TITLE[panel]}</span>
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

              {panel === 'audio' &&
                audioTracks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="xp-menu-item xp-menu-option"
                    role="menuitemradio"
                    aria-checked={activeAudioTrack === t.id}
                    onClick={() => {
                      onAudioTrack(t.id)
                      setPanel('main')
                    }}
                  >
                    <span className="xp-menu-check">{activeAudioTrack === t.id && <CheckIcon />}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
