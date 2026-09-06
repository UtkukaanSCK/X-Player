import { useCallback, useEffect, useRef } from 'react'

/** Width of the drawn frame. The height follows the video's own shape. */
const WIDTH = 160

interface Options {
  /** The progressive file to take frames from. */
  src: string
  /** Streams are excluded: a second hls.js pipeline costs more than the feature. */
  isStream: boolean
}

export interface FramePreview {
  /** False when frames are not worth fetching here; the bar then shows a time alone. */
  enabled: boolean
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** Ask for the frame at this time. Cheap enough to call on every pointermove. */
  request: (seconds: number) => void
  /** The pointer has left the bar. */
  release: () => void
}

/**
 * The frame under the pointer, drawn from a second copy of the video.
 *
 * No sprite sheet and nothing for the host to generate: a hidden element seeks
 * to the hovered second and its frame is drawn to a canvas. That makes the
 * feature work on any file the player can already play, which is the whole
 * reason for doing it this way.
 *
 * It is not free, so it is bounded rather than clever. The element is not
 * created until someone hovers the bar, so a video nobody scrubs never costs
 * anything. Only one seek is ever in flight, and the newest request wins - a
 * pointer sweeping the bar asks for sixty frames a second and gets the one it
 * ends on, rather than a queue of sixty decodes. Frames are asked for by whole
 * second, so crossing one costs nothing until the second changes.
 *
 * Three cases opt out entirely: a stream, because a second hls.js pipeline is
 * 184 kB and a second MSE buffer; a viewer who has asked their browser to save
 * data, because this is a second copy of the video; and a source that has not
 * been given yet.
 */
export function useFramePreview({ src, isStream }: Options): FramePreview {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  /** The most recent request, kept until the current seek finishes. */
  const wanted = useRef<number | null>(null)
  const seeking = useRef(false)
  const drawn = useRef(-1)

  const saveData =
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  const enabled = !!src && !isStream && !saveData

  const draw = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return
    const height = Math.round((WIDTH * video.videoHeight) / video.videoWidth)
    if (canvas.width !== WIDTH || canvas.height !== height) {
      canvas.width = WIDTH
      canvas.height = height
    }
    canvas.getContext('2d')?.drawImage(video, 0, 0, WIDTH, height)
    canvas.hidden = false
    drawn.current = Math.floor(video.currentTime)
  }, [])

  /** Take the newest request, if the last one has finished. */
  const pump = useCallback(() => {
    if (seeking.current) return
    const want = wanted.current
    const video = videoRef.current
    if (want === null || !video) return
    wanted.current = null
    seeking.current = true
    /*
     * fastSeek settles on the nearest keyframe, which is the right trade here:
     * a preview wants to be quick and approximately right, and an exact seek
     * decodes forward from that keyframe to reach a frame nobody asked for.
     */
    if (typeof video.fastSeek === 'function') video.fastSeek(want)
    else video.currentTime = want
  }, [])

  const request = useCallback(
    (seconds: number) => {
      if (!enabled) return
      if (Math.floor(seconds) === drawn.current) return

      let video = videoRef.current
      if (!video) {
        video = document.createElement('video')
        video.preload = 'metadata'
        video.muted = true
        video.playsInline = true
        video.src = src
        video.addEventListener('seeked', () => {
          seeking.current = false
          draw()
          pump()
        })
        // A file that will not load is not worth waiting on for the rest of the session.
        video.addEventListener('error', () => {
          seeking.current = true
        })
        videoRef.current = video
      }

      wanted.current = Math.max(0, seconds)
      if (video.readyState >= 1) pump()
      else video.addEventListener('loadedmetadata', pump, { once: true })
    },
    [enabled, src, draw, pump],
  )

  const release = useCallback(() => {
    wanted.current = null
    const canvas = canvasRef.current
    if (canvas) canvas.hidden = true
    drawn.current = -1
  }, [])

  /* A different video means the frames drawn so far are of the wrong film. */
  useEffect(() => {
    return () => {
      const video = videoRef.current
      videoRef.current = null
      wanted.current = null
      seeking.current = false
      drawn.current = -1
      if (!video) return
      video.removeAttribute('src')
      video.load()
    }
  }, [src])

  return { enabled, canvasRef, request, release }
}
