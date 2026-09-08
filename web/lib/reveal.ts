import { cubicBezier, useSpring, type MotionValue } from 'motion/react'

/**
 * How everything on this page arrives.
 *
 * Three sections were each reaching for their own numbers, which is how a page
 * ends up with three different ideas of what "rising into place" means. The
 * distances still differ - deliberately, and each says why where it is used -
 * but the shape of the movement is one decision made here.
 */

/**
 * Deceleration, rather than tracking the scroll wheel.
 *
 * A scroll-linked transform with no easing moves exactly as fast as the finger
 * does, which reads as a diagram of the scroll position rather than as
 * something arriving. This curve spends most of its travel early and settles
 * slowly, so the last of the travel is a settle rather than a slide.
 *
 * Softer than the first attempt. A stronger curve - 0.22, 1, 0.36, 1 - finished
 * the whole movement inside the first third of its window: measured, the stage
 * went from 40px to 5px across 2% of the section and was home by 4%. That is a
 * snap with an easing name on it, not a settle.
 */
export const REVEAL_EASE = cubicBezier(0.33, 1, 0.68, 1)

/**
 * Scroll progress with the jitter taken out.
 *
 * Raw scroll progress is as noisy as the input device: a trackpad's momentum
 * and a mouse wheel's steps both arrive as a series of jumps, and a transform
 * driven straight from them stutters in a way that is easy to feel and hard to
 * name. The spring is deliberately overdamped - for this mass and stiffness the
 * critical value is about 18, so 30 cannot overshoot - because a reveal that
 * springs past its resting place and comes back is a different effect, and not
 * one this page wants.
 *
 * `damp` is false under reduced motion, where the raw value is passed through
 * untouched: the transforms are identities there anyway, and a spring settling
 * towards them would be motion introduced by the thing meant to remove it.
 */
const SPRING = { stiffness: 260, damping: 30, mass: 0.3, restDelta: 0.0005 }

export function useRevealProgress(progress: MotionValue<number>, damp: boolean): MotionValue<number> {
  // Called unconditionally; which of the two is returned is the choice.
  const smoothed = useSpring(progress, SPRING)
  return damp ? smoothed : progress
}
