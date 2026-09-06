import { useEffect, useState } from 'react'
import type { PlayerState, XPlayerAudioTrack, XPlayerSource } from '../types'
import { ChevronLeftIcon, SettingsIcon } from './Icons'
import { Option, Row } from './MenuItem'
import { qualityChoices } from './quality-choices'
import { useMenu } from './useMenu'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

interface Props {
  state: PlayerState
  audioTracks: XPlayerAudioTrack[]
  activeAudioTrack: number
  sources: XPlayerSource[]
  onRate: (rate: number) => void
  onTextTrack: (index: number) => void
  onAudioTrack: (id: number) => void
  onLevel: (level: number) => void
  onSource: (index: number) => void
  onToggleMute: () => void
  onOpenChange: (open: boolean) => void
}

type Panel = 'main' | 'speed' | 'subtitles' | 'audio' | 'quality' | 'sound'

const PANEL_TITLE: Record<Exclude<Panel, 'main'>, string> = {
  speed: 'Playback speed',
  subtitles: 'Subtitles',
  audio: 'Audio track',
  quality: 'Quality',
  sound: 'Sound',
}

const rateLabel = (rate: number) => (rate === 1 ? 'Normal' : `${rate}x`)

/**
 * Speed, subtitles and the audio track, plus whatever the control bar has run
 * out of room for.
 *
 * Quality has its own button on the bar because it is the setting people reach
 * for when playback is struggling, and burying it two clicks deep means it may
 * as well not exist. But a narrow player cannot hold that button, and hiding a
 * control with nowhere to go is not a tier - it is a control the viewer can no
 * longer reach. So quality and sound come back here at exactly the widths where
 * they leave the bar, marked with data-xp-from, which mirrors the bar's
 * data-xp-until. Each control is in one place at any width and never in both.
 *
 * The audio row only appears when there is genuinely more than one track. A
 * menu entry that always says "Track 1" teaches people to ignore the menu.
 */
export function SettingsMenu({
  state,
  audioTracks,
  activeAudioTrack,
  sources,
  onRate,
  onTextTrack,
  onAudioTrack,
  onLevel,
  onSource,
  onToggleMute,
  onOpenChange,
}: Props) {
  const { open, setOpen, wrapRef, buttonRef } = useMenu(onOpenChange)
  const [panel, setPanel] = useState<Panel>('main')

  useEffect(() => {
    if (!open) setPanel('main')
  }, [open])

  // The same source of truth the bar's own quality button uses, so the two can
  // never offer different choices for the same video.
  const quality = qualityChoices(state, sources, onLevel, onSource)

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

              {/* Both appear only at the width where the bar drops them, which
                  is what data-xp-from means. The wrapper is display: contents,
                  so the row it holds is still a direct flex item of the panel
                  and nothing about the layout changes when it is present. */}
              {quality && (
                <div data-xp-from="tight">
                  <Row
                    label="Quality"
                    value={quality.auto ? `Auto (${quality.label})` : quality.label}
                    onOpen={() => setPanel('quality')}
                  />
                </div>
              )}
              <div data-xp-from="minimal">
                <Row
                  label="Sound"
                  value={state.muted ? 'Muted' : 'On'}
                  onOpen={() => setPanel('sound')}
                />
              </div>
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

              {panel === 'quality' &&
                quality?.options.map((option) => (
                  <Option
                    key={option.key}
                    checked={option.checked}
                    label={option.label}
                    onSelect={choose(option.select)}
                  />
                ))}

              {/* Two options rather than a toggle row, because every other
                  entry in this menu states what is selected and this should
                  read the same way. onToggleMute only flips, so choosing the
                  state already in force does nothing rather than flipping to
                  it and back. */}
              {panel === 'sound' && (
                <>
                  <Option
                    checked={!state.muted}
                    label="On"
                    onSelect={choose(() => {
                      if (state.muted) onToggleMute()
                    })}
                  />
                  <Option
                    checked={state.muted}
                    label="Muted"
                    onSelect={choose(() => {
                      if (!state.muted) onToggleMute()
                    })}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
