import { useEffect, useState } from 'react'

/**
 * Sets up the scroll-driven animation for the whole page.
 *
 * GSAP is imported dynamically and only when it will actually be used: a visitor
 * who prefers reduced motion never downloads it, and neither does a touch device,
 * where pinned scroll sections are more fragile than they are impressive. In both
 * cases the page falls back to its static layout, which is fully readable on its
 * own - the animation is decoration, never the only way to see the content.
 */
export function useScrollScenes() {
  const [engaged, setEngaged] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    const narrow = window.innerWidth < 900
    if (reducedMotion) return

    let cleanup: (() => void) | undefined
    let cancelled = false

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      if (cancelled) return
      gsap.registerPlugin(ScrollTrigger)
      setEngaged(true)

      const ctx = gsap.context(() => {
        const allowPinning = !coarsePointer && !narrow

        /* ---------------------------------------------------------- hero */

        const heroPlayer = '[data-anim="hero-player"]'
        if (document.querySelector(heroPlayer)) {
          // The player starts tilted back in space and flattens as you scroll,
          // as though it is rising to meet the viewer.
          gsap.fromTo(
            heroPlayer,
            { rotateX: 16, scale: 0.92, y: 26, transformPerspective: 1600 },
            {
              rotateX: 0,
              scale: 1,
              y: 0,
              ease: 'none',
              scrollTrigger: {
                trigger: '[data-scene="hero"]',
                start: 'top top',
                end: '+=70%',
                scrub: 0.6,
                pin: allowPinning ? '[data-scene="hero"] .scene-stage' : false,
                pinSpacing: false,
              },
            },
          )
        }

        // Depth layers drift at different rates; that difference is the depth.
        document.querySelectorAll<HTMLElement>('[data-depth]').forEach((layer) => {
          const depth = Number(layer.dataset.depth ?? '4')
          const rate = [0.1, 0.25, 0.5, 0.8, 1, 1.2][depth] ?? 1
          if (rate === 1) return
          gsap.to(layer, {
            yPercent: (1 - rate) * 22,
            ease: 'none',
            scrollTrigger: {
              trigger: layer.closest('[data-scene]') ?? layer,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.8,
            },
          })
        })

        /* ------------------------------------------- word-by-word lighting */

        document.querySelectorAll<HTMLElement>('[data-anim="light-words"]').forEach((el) => {
          const words = el.querySelectorAll('.word')
          if (!words.length) return
          gsap.fromTo(
            words,
            { opacity: 0.18 },
            {
              opacity: 1,
              stagger: 0.12,
              ease: 'none',
              scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 55%', scrub: 0.5 },
            },
          )
        })

        /* --------------------------------------------------- entrances */

        document.querySelectorAll<HTMLElement>('[data-anim="rise"]').forEach((el, i) => {
          gsap.from(el, {
            y: 44,
            opacity: 0,
            duration: 0.75,
            delay: (i % 4) * 0.06,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          })
        })

        // A clip-path wipe reads as the block being uncovered rather than fading in.
        document.querySelectorAll<HTMLElement>('[data-anim="wipe"]').forEach((el) => {
          gsap.fromTo(
            el,
            { clipPath: 'inset(0 0 100% 0)' },
            {
              clipPath: 'inset(0 0 0% 0)',
              ease: 'none',
              scrollTrigger: { trigger: el, start: 'top 85%', end: 'top 45%', scrub: 0.5 },
            },
          )
        })

        /* ------------------------------------------------- card stack */

        const cards = gsap.utils.toArray<HTMLElement>('[data-anim="stack-card"]')
        cards.forEach((card, i) => {
          gsap.fromTo(
            card,
            { y: 70, opacity: 0, scale: 0.96 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 0.7,
              delay: (i % 3) * 0.08,
              ease: 'power3.out',
              scrollTrigger: { trigger: card, start: 'top 90%', once: true },
            },
          )
        })

        /* ------------------------------------------------ number counters */

        document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
          const target = Number(el.dataset.count ?? '0')
          const decimals = Number(el.dataset.countDecimals ?? '0')
          const box = { value: 0 }
          gsap.to(box, {
            value: target,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top 88%', end: 'top 55%', scrub: 0.4 },
            onUpdate: () => {
              el.textContent = box.value.toFixed(decimals)
            },
          })
        })

        // will-change is a promise to the compositor, not a decoration: only make
        // it while an element is actually on screen.
        document.querySelectorAll<HTMLElement>('[data-depth], [data-anim]').forEach((el) => {
          ScrollTrigger.create({
            trigger: el,
            start: 'top bottom',
            end: 'bottom top',
            onToggle: (self) => {
              el.style.willChange = self.isActive ? 'transform, opacity' : ''
            },
          })
        })
      })

      cleanup = () => ctx.revert()
    })()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  return engaged
}
