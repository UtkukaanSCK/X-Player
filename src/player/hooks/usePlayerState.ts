import { useReducer } from 'react'
import type { PlayerAction, PlayerState } from '../types'

export const initialState: PlayerState = {
  status: 'idle',
  playing: false,
  waiting: false,
  duration: 0,
  volume: 1,
  muted: false,
  rate: 1,
  levels: [],
  selectedLevel: -1,
  activeLevel: -1,
  textTracks: [],
  activeTextTrack: -1,
  activeSource: 0,
  fullscreen: false,
  pip: false,
  error: null,
  blockedAutoplay: false,
}

/** Exported for its unit tests; the hook below is the only runtime consumer. */
export function reducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'reset':
      // Switching quality goes through this path, and none of these belong to
      // the rendition: the volume, the speed, the chosen subtitle language and
      // the subtitle list itself all belong to the video. Clearing them here
      // made the subtitles button vanish the moment someone changed quality.
      return {
        ...initialState,
        volume: state.volume,
        muted: state.muted,
        rate: state.rate,
        activeSource: state.activeSource,
        textTracks: state.textTracks,
        activeTextTrack: state.activeTextTrack,
      }
    case 'loading':
      return { ...state, status: 'loading', error: null }
    case 'ready':
      return { ...state, status: 'ready', error: null, duration: action.duration }
    case 'duration':
      return state.duration === action.duration ? state : { ...state, duration: action.duration }
    case 'playing':
      if (state.playing === action.playing) return state
      return { ...state, playing: action.playing, blockedAutoplay: false }
    case 'waiting':
      return state.waiting === action.waiting ? state : { ...state, waiting: action.waiting }
    case 'volume':
      return { ...state, volume: action.volume, muted: action.muted }
    case 'rate':
      return { ...state, rate: action.rate }
    case 'levels':
      return { ...state, levels: action.levels }
    case 'selectedLevel':
      return { ...state, selectedLevel: action.level }
    case 'activeLevel':
      return state.activeLevel === action.level ? state : { ...state, activeLevel: action.level }
    case 'textTracks': {
      // Rewriting the same list would produce a new object and force a needless render.
      const same =
        state.textTracks.length === action.tracks.length &&
        state.textTracks.every((t, i) => t.id === action.tracks[i].id && t.label === action.tracks[i].label)
      return same ? state : { ...state, textTracks: action.tracks }
    }
    case 'activeTextTrack':
      return state.activeTextTrack === action.index ? state : { ...state, activeTextTrack: action.index }
    case 'activeSource':
      return state.activeSource === action.index ? state : { ...state, activeSource: action.index }
    case 'fullscreen':
      return state.fullscreen === action.value ? state : { ...state, fullscreen: action.value }
    case 'pip':
      return state.pip === action.value ? state : { ...state, pip: action.value }
    case 'error':
      return { ...state, status: 'error', error: action.message, waiting: false, playing: false }
    case 'blockedAutoplay':
      return { ...state, blockedAutoplay: action.value }
    default:
      return state
  }
}

export function usePlayerState() {
  return useReducer(reducer, initialState)
}
