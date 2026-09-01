import { describe, expect, it } from 'vitest'
import { initialState, reducer } from './usePlayerState'
import type { PlayerState } from '../types'

/**
 * Two bugs came out of this reducer, and both are pinned here.
 *
 * The subtitles button vanished whenever anyone changed quality, because a
 * quality switch rebuilds the source and `reset` was clearing the track list
 * along with it. And the player once locked into an infinite render loop
 * because actions that changed nothing still returned a new object, so an
 * effect watching that state re-ran forever.
 */

const playing: PlayerState = {
  ...initialState,
  status: 'ready',
  playing: true,
  duration: 620,
  volume: 0.4,
  muted: true,
  rate: 1.5,
  levels: [{ id: 0, height: 1080, bitrate: 5_000_000, label: '1080p' }],
  selectedLevel: 0,
  activeLevel: 0,
  textTracks: [
    { id: 0, label: 'English' },
    { id: 1, label: 'Türkçe' },
  ],
  activeTextTrack: 1,
  activeSource: 2,
  error: 'something went wrong',
}

describe('reset', () => {
  const after = reducer(playing, { type: 'reset' })

  it('keeps what belongs to the video rather than the rendition', () => {
    // Changing quality must not change the language, the volume or the speed.
    expect(after.volume).toBe(0.4)
    expect(after.muted).toBe(true)
    expect(after.rate).toBe(1.5)
    expect(after.textTracks).toHaveLength(2)
    expect(after.activeTextTrack).toBe(1)
    expect(after.activeSource).toBe(2)
  })

  it('clears what belongs to the source being torn down', () => {
    expect(after.status).toBe('idle')
    expect(after.playing).toBe(false)
    expect(after.duration).toBe(0)
    expect(after.levels).toEqual([])
    expect(after.error).toBeNull()
  })
})

describe('actions that change nothing return the same object', () => {
  // Identity, not equality: a new object here restarts every effect watching
  // this state, which is how the render loop happened.
  const cases: [string, PlayerState, Parameters<typeof reducer>[1]][] = [
    ['duration', playing, { type: 'duration', duration: 620 }],
    ['playing', playing, { type: 'playing', playing: true }],
    ['waiting', playing, { type: 'waiting', waiting: false }],
    ['activeLevel', playing, { type: 'activeLevel', level: 0 }],
    ['activeTextTrack', playing, { type: 'activeTextTrack', index: 1 }],
    ['activeSource', playing, { type: 'activeSource', index: 2 }],
    ['fullscreen', playing, { type: 'fullscreen', value: false }],
    ['pip', playing, { type: 'pip', value: false }],
  ]

  for (const [name, state, action] of cases) {
    it(`${name} bails out when the value is unchanged`, () => {
      expect(reducer(state, action)).toBe(state)
    })
  }

  it('textTracks bails out on an identical list, even a different array', () => {
    const same = reducer(playing, {
      type: 'textTracks',
      tracks: [
        { id: 0, label: 'English' },
        { id: 1, label: 'Türkçe' },
      ],
    })
    expect(same).toBe(playing)
  })

  it('but still updates when the list really differs', () => {
    const changed = reducer(playing, { type: 'textTracks', tracks: [{ id: 0, label: 'English' }] })
    expect(changed).not.toBe(playing)
    expect(changed.textTracks).toHaveLength(1)
  })
})

describe('error', () => {
  it('stops playback and clears the spinner, so nothing spins behind a message', () => {
    const failed = reducer(playing, { type: 'error', message: 'Connection lost.' })
    expect(failed.status).toBe('error')
    expect(failed.error).toBe('Connection lost.')
    expect(failed.playing).toBe(false)
    expect(failed.waiting).toBe(false)
  })

  it('is cleared by loading again, so a retry does not show the old message', () => {
    const retrying = reducer(reducer(playing, { type: 'error', message: 'x' }), { type: 'loading' })
    expect(retrying.error).toBeNull()
    expect(retrying.status).toBe('loading')
  })
})

describe('playing', () => {
  it('clears the blocked-autoplay flag, because playback evidently is not blocked', () => {
    const blocked = reducer(initialState, { type: 'blockedAutoplay', value: true })
    expect(blocked.blockedAutoplay).toBe(true)
    expect(reducer(blocked, { type: 'playing', playing: true }).blockedAutoplay).toBe(false)
  })
})
