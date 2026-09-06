import { useEffect, useState } from 'react'
import type { PlayerState, XPlayerAudioTrack } from '../types'
import { ChevronLeftIcon, SettingsIcon } from './Icons'
import { Option, Row } from './MenuItem'
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

const rateLabel = (rate: number) => (rate === 1 ? 'Normal' : `${rate}x`)

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

  /* Every choice does the same two things: make it, then come back. */
  const choose = (pick: () => void) => () => {
    pick()
    setPanel('main')
  }

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
              <Row label="Playback speed" value={rateLabel(state.rate)} onOpen={() => setPanel('speed')} />
              {state.textTracks.length > 0 && (
                <Row label="Subtitles" value={subtitleLabel} onOpen={() => setPanel('subtitles')} />
              )}
              {audioTracks.length > 1 && (
                <Row label="Audio track" value={audioLabel} onOpen={() => setPanel('audio')} />
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
                  <Option
                    key={r}
                    checked={state.rate === r}
                    label={rateLabel(r)}
                    onSelect={choose(() => onRate(r))}
                  />
                ))}

              {panel === 'subtitles' && (
                <>
                  <Option
                    checked={state.activeTextTrack === -1}
                    label="Off"
                    onSelect={choose(() => onTextTrack(-1))}
                  />
                  {state.textTracks.map((t, i) => (
                    <Option
                      key={t.id}
                      checked={state.activeTextTrack === i}
                      label={t.label}
                      onSelect={choose(() => onTextTrack(i))}
                    />
                  ))}
                </>
              )}

              {panel === 'audio' &&
                audioTracks.map((t) => (
                  <Option
                    key={t.id}
                    checked={activeAudioTrack === t.id}
                    label={t.label}
                    onSelect={choose(() => onAudioTrack(t.id))}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
