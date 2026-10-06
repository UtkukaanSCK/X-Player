'use client'

import dynamic from 'next/dynamic'
import { POSTER } from '@/lib/poster'
import { FRAME, PROOF_BOX, ProofHeading, SCREEN } from './ProofHeading'

/**
 * The comparison never renders on the server.
 *
 * There is nothing in it a server could produce: two video elements, a service
 * worker throttling their bytes, readings taken off the elements roughly three
 * times a second, and transforms driven by scroll position. Prerendering it
 * produced markup the client immediately contradicted, and React reported the
 * hydration mismatch - correctly, because the two really were different.
 *
 * The placeholder carries the heading: this is the markup the static export
 * ships, so leaving the h1 out of it left the exported page with no h1 at all.
 * Both it and the real section render the same ProofHeading.
 *
 * It also holds the real section's geometry - the same pinned box, the same
 * column and two frames already showing the poster - because the heading is
 * centred in that box with whatever is under it. A placeholder that was only a
 * line of text centred the heading on far less than the comparison holds, about
 * 250px lower at 1366x768, and the first thing the page did was move it.
 */
const Proof = dynamic(() => import('./Proof').then((m) => m.Proof), {
  ssr: false,
  loading: () => (
    <section className="relative h-[200svh] short:h-auto">
      <div className={PROOF_BOX}>
        <ProofHeading />
        <div className="proof-column">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:gap-6">
            {[0, 1].map((key) => (
              // A size container like the real panel, which the frame's corner is measured against.
              <div key={key} className="@container min-w-0">
                <div className={FRAME}>
                  <div className={SCREEN}>
                    <img src={POSTER} alt="" className="h-full w-full object-contain" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/*
            The bottom padding stands in for everything under the frames:
            captions, readings, the connection control and the verdict. Their
            height follows where the sentences wrap, so it is held in steps,
            each measured against the real section (Archivo, Chromium): from
            367 to 412px under 25rem, 323 to 347 up to 45rem, 290 to 308 up to
            56rem, where the verdict is two lines, and 325 to 341 beyond. The
            steps keep the heading within about 10px of where the comparison
            puts it, at the sizes that pin.
          */}
          <p
            role="status"
            className="pt-3 pb-[21.5rem] text-center text-caption text-muted min-[25rem]:pb-[19rem] min-[45rem]:pb-[16.75rem] min-[56rem]:pb-[19rem]"
          >
            Preparing the comparison…
          </p>
        </div>
      </div>
    </section>
  ),
})

export function ProofMount() {
  return <Proof />
}
