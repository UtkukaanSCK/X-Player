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
            captions, readings, the connection control, the method line and the
            verdict. Their height follows where those sentences wrap, so it is
            held in steps, each measured against the real section (Archivo,
            Chromium, widths swept every 20px): 365px under 23.75rem, 335px up
            to 26rem, 305px up to 41rem, 278px up to 51.25rem, 286px beyond.
            Inside a step the real height moves by up to about 20px when a
            sentence takes another line, and the centred heading moves half of
            that, so the steps keep it within about 10px of where the
            comparison puts it, at the sizes that pin.
          */}
          <p
            role="status"
            className="pt-3 pb-[22.8rem] text-center text-caption text-muted min-[23.75rem]:pb-[20.9rem] min-[26rem]:pb-[19rem] min-[41rem]:pb-[17.4rem] min-[51.25rem]:pb-[17.9rem]"
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
