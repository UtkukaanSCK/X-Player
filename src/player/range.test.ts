import { describe, expect, it } from 'vitest'
import { MIN_RANGE, clampRange } from './range'

/**
 * The rules a dragged selection obeys.
 *
 * A pointer can be anywhere, including outside the bar and on top of the other
 * handle, and a keyboard can hold an arrow key down. Whatever arrives, what
 * comes back has to be a selection the host can hand to ffmpeg: inside the
 * video, in order, and long enough to be worth cutting.
 */

describe('clampRange', () => {
  it('keeps the handles apart when the start is dragged onto the end', () => {
    expect(clampRange({ start: 10, end: 10 }, 60, 'start')).toEqual({ start: 10 - MIN_RANGE, end: 10 })
  })

  it('keeps the handles apart when the end is dragged onto the start', () => {
    expect(clampRange({ start: 5, end: 5 }, 60, 'end')).toEqual({ start: 5, end: 5 + MIN_RANGE })
  })

  it('never lets a selection leave the video', () => {
    expect(clampRange({ start: -3, end: 90 }, 60, 'start')).toEqual({ start: 0, end: 60 })
  })

  it('makes room at the far end by moving the handle that was not dragged', () => {
    // The end is already against the last frame, so the start is what gives.
    expect(clampRange({ start: 59.95, end: 60 }, 60, 'end')).toEqual({ start: 60 - MIN_RANGE, end: 60 })
  })

  it('gives back the whole of a video too short to hold a selection', () => {
    expect(clampRange({ start: 0.05, end: 0.1 }, 0.1, 'start')).toEqual({ start: 0, end: 0.1 })
  })

  it('survives a video whose duration is not known yet', () => {
    expect(clampRange({ start: 2, end: 4 }, Number.NaN, 'start')).toEqual({ start: 0, end: 0 })
  })
})
