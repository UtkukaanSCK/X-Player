/**
 * Runs the end-to-end suite against a server that is already up.
 *
 *   npm run dev            # in one terminal
 *   npm run e2e            # in another
 *
 * Set BASE_URL to point at a preview or deployed build instead.
 */
import { spawnSync } from 'node:child_process'

const BASE = process.env.BASE_URL ?? 'http://localhost:5199'
const suites = ['player', 'embed', 'netsim', 'motion']

try {
  const res = await fetch(BASE, { method: 'HEAD' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
} catch (err) {
  console.error(`Cannot reach ${BASE} - start the dev server first (npm run dev -- --port 5199).`)
  console.error(String(err))
  process.exit(1)
}

const failed = []
for (const suite of suites) {
  console.log(`\n──────── ${suite} ────────`)
  const res = spawnSync(process.execPath, [`scripts/e2e/${suite}.mjs`], {
    stdio: 'inherit',
    env: { ...process.env, BASE_URL: BASE },
  })
  if (res.status !== 0) failed.push(suite)
}

console.log('\n════════ summary ════════')
if (failed.length) {
  console.error(`FAILED: ${failed.join(', ')}`)
  process.exit(1)
}
console.log(`All ${suites.length} suites passed.`)
