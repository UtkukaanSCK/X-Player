import { describe, expect, it } from 'vitest'
import { formatTime, spokenTime } from './format'

/**
 * Both of these run on every animation frame while a video plays, and both feed
 * something a person perceives: one the clock on the bar, the other what a
 * screen reader says. The edge cases below are the ones a live stream and a
 * still-loading video actually produce.
 */

describe('formatTime', () => {
  it('drops the hour until there is one', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(5)).toBe('0:05')
    expect(formatTime(65)).toBe('1:05')
    expect(formatTime(599)).toBe('9:59')
  })

  it('pads minutes only once hours appear', () => {
    expect(formatTime(3600)).toBe('1:00:00')
    expect(formatTime(3723)).toBe('1:02:03')
    expect(formatTime(36000)).toBe('10:00:00')
  })

  it('truncates rather than rounds, so the clock never runs ahead of the frame', () => {
    expect(formatTime(59.9)).toBe('0:59')
    expect(formatTime(3599.99)).toBe('59:59')
  })

  it('survives what a video element reports before it has metadata', () => {
    expect(formatTime(Number.NaN)).toBe('0:00')
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00')
    expect(formatTime(-10)).toBe('0:00')
  })
})

describe('spokenTime', () => {
  it('says words, because a screen reader reads 1:05 as digits', () => {
    expect(spokenTime(65)).toBe('1 minute 5 seconds')
    expect(spokenTime(3723)).toBe('1 hour 2 minutes 3 seconds')
  })

  it('leaves out units that are zero, but always says seconds', () => {
    expect(spokenTime(0)).toBe('0 seconds')
    expect(spokenTime(45)).toBe('45 seconds')
    expect(spokenTime(3600)).toBe('1 hour 0 seconds')
  })

  it('gets singulars right', () => {
    expect(spokenTime(1)).toBe('1 second')
    expect(spokenTime(60)).toBe('1 minute 0 seconds')
    expect(spokenTime(7200)).toBe('2 hours 0 seconds')
  })

  it('never announces a negative position', () => {
    expect(spokenTime(-5)).toBe('0 seconds')
  })
})
