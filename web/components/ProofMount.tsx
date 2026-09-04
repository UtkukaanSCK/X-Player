'use client'

import dynamic from 'next/dynamic'
import { ProofHeading } from './ProofHeading'

/**
 * The comparison never renders on the server.
 *
 * There is nothing in it a server could produce: two video elements, a service
 * worker throttling their bytes, readings taken off the elements roughly three
 * times a second, and transforms driven by scroll position. Prerendering it
 * produced markup the client immediately contradicted, and React reported the
 * hydration mismatch - correctly, because the two really were different.
 *
 * The placeholder holds the section's height so nothing below it jumps when the
 * real thing arrives, and it carries the heading: this is the markup the static
 * export ships, so leaving the h1 out of it left the exported page with no h1
 * at all. Both it and the real section render the same ProofHeading.
 */
const Proof = dynamic(() => import('./Proof').then((m) => m.Proof), {
  ssr: false,
  loading: () => (
    <section className="relative h-[200vh]">
      <div className="sticky top-0 flex h-screen flex-col justify-center gap-5 overflow-hidden px-5 py-5 sm:px-8">
        <ProofHeading />
        <p className="mx-auto w-full max-w-6xl font-mono text-caption text-muted" role="status">
          Preparing the comparison…
        </p>
      </div>
    </section>
  ),
})

export function ProofMount() {
  return <Proof />
}
