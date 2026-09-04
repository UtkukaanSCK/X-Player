/**
 * Runs the suites against a server that is already up.
 *
 *   npm run dev     # in one terminal
 *   npm run e2e     # in another
 *
 * Set BASE_URL to point at a built preview or a deployment instead.
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5175'
const SUITES = ['proof', 'motion', 'wizard', 'access', 'deploy']

try {
  const res = await fetch(BASE, { method: 'HEAD' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
} catch (err) {
  console.error(`Cannot reach ${BASE} — start the server first (npm run dev).`)
  console.error(String(err))
  process.exit(1)
}

const failed = []
for (const suite of SUITES) {
  console.log(`\n──────── ${suite} ────────`)
  const res = spawnSync(process.execPath, [resolve(import.meta.dirname, `${suite}.mjs`)], {
    stdio: 'inherit',
    env: { ...process.env, BASE_URL: BASE },
  })
  if (res.status !== 0) failed.push(suite)
}

console.log('\n════════ summary ════════')
if (failed.length > 0) {
  console.error(`FAILED: ${failed.join(', ')}`)
  process.exit(1)
}
console.log(`All ${SUITES.length} suites passed.`)
