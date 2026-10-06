import { ProofMount } from '@/components/ProofMount'
import { GetIt } from '@/components/GetIt'
import { SiteHeader } from '@/components/SiteHeader'
import { StartAtTop } from '@/components/StartAtTop'
import { Source } from '@/components/Source'

export default function Page() {
  return (
    <>
      <StartAtTop />
      <SiteHeader />
      <main>
        <ProofMount />
        <GetIt />
        <Source />
      </main>
      {/*
        Outside main, or it is not a footer.
        A `footer` descended from `main` is scoped to that element and gets no
        contentinfo role, so the page had no way for anyone navigating by
        landmark to reach the credits at all.
      */}
      <footer className="border-t border-line bg-band px-(--gutter)">
        <div className="mx-auto flex max-w-(--page-max) flex-col gap-1 py-6 text-center text-micro text-balance text-muted sm:flex-row sm:justify-between sm:py-8 sm:text-left">
          <p>Clip: Big Buck Bunny © Blender Foundation, CC BY 3.0</p>
          <p>X-Player is MIT licensed</p>
        </div>
      </footer>
    </>
  )
}
