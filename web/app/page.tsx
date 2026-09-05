import { ProofMount } from '@/components/ProofMount'
import { GetIt } from '@/components/GetIt'
import { StartAtTop } from '@/components/StartAtTop'
import { Source } from '@/components/Source'

export default function Page() {
  return (
    <>
      <StartAtTop />
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
      <footer className="border-t border-line px-5 py-8 text-center sm:px-8">
        <p className="font-mono text-micro text-muted">
          Clip: Sintel © Blender Foundation, CC BY 3.0 · X-Player is MIT licensed
        </p>
      </footer>
    </>
  )
}
