import { useEffect } from 'react'

/**
 * Scroll-driven motion for the page.
 *
 * The playhead rail is the page's main piece of movement, so everything here
 * stays quiet: sections settle in, the hero player straightens as you scroll,
 * spec rows tick in. Scattered effects are what make a page feel automated, and
 * the rail already carries the idea.
 *
 * GSAP is imported dynamically and only when it will be used. A visitor who
 * prefers reduced motion never downloads it, and the static layout is complete
 * on its own - nothing here is the only way to see the content.
 */
export function useScrollScenes() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let cleanup: (() => void) | undefined
    let cancelled = false

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      if (cancelled) return
      gsap.registerPlugin(ScrollTrigger)

      const coarse = window.matchMedia('(pointer: coarse)').matches
      const narrow = window.innerWidth < 980

      const ctx = gsap.context(() => {
        // The hero player sits back in space and straightens as you scroll into
        // the page - the one flourish, on the one element the page is about.
        const heroPlayer = '[data-anim="hero-player"]'
        if (!coarse && !narrow && document.querySelector(heroPlayer)) {
          gsap.fromTo(
            heroPlayer,
            { rotateX: 13, scale: 0.94, transformPerspective: 1800, transformOrigin: '50% 90%' },
            {
              rotateX: 0,
              scale: 1,
              ease: 'none',
              scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 60%', scrub: 0.6 },
            },
          )
        }

        // Section headers and the blocks under them arrive together, once.
        gsap.utils
          .toArray<HTMLElement>('.scene-head, .specstrip, .compare-grid, .install-grid, .play-stage')
          .forEach((el) => {
            gsap.from(el, {
              y: 26,
              opacity: 0,
              duration: 0.6,
              ease: 'power2.out',
              scrollTrigger: { trigger: el, start: 'top 90%', once: true },
            })
          })

        // Spec rows tick in like a list being read out.
        gsap.utils.toArray<HTMLElement>('[data-anim="row"]').forEach((el, i) => {
          gsap.from(el, {
            opacity: 0,
            x: -10,
            duration: 0.45,
            delay: (i % 8) * 0.05,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 92%', once: true },
          })
        })
      })

      // Positions are measured when triggers are created; media, fonts and the
      // rail all move things afterwards. Recompute rather than trust the first read.
      ScrollTrigger.refresh()
      const onLoad = () => ScrollTrigger.refresh()
      window.addEventListener('load', onLoad)

      cleanup = () => {
        window.removeEventListener('load', onLoad)
        ctx.revert()
      }
    })()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])
}
