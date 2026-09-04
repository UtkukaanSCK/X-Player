import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { extname, join } from 'node:path'

/**
 * Runs oxlint over this project's own sources.
 *
 * It has to name every file rather than pointing at a directory. This project
 * sits inside a folder the player repository gitignores, and oxlint honours
 * gitignore while walking, so `oxlint electron` finds nothing at all - which
 * looks exactly like a clean run and is how this project went unlinted without
 * anyone noticing. Naming the files sidesteps the walk entirely.
 *
 * The lasting fix is for this folder to be its own git repository, which it will
 * need anyway to deploy on its own.
 */
const ROOTS = ['app', 'components', 'hooks', 'scripts', 'e2e']
const EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.jsx'])
const SKIP = new Set(['node_modules', '.next', 'out'])

function collect(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) collect(path, found)
    else if (EXTENSIONS.has(extname(entry.name))) found.push(path)
  }
  return found
}

const files = ROOTS.filter((r) => existsSync(r)).flatMap((r) => collect(r))
if (files.length === 0) {
  console.error('lint: found no source files, which cannot be right')
  process.exit(1)
}

const require = createRequire(import.meta.url)
let binary
try {
  // Prefer this project's own copy; fall back to the player's while the two
  // folders sit next to each other.
  binary = require.resolve('oxlint/bin/oxlint')
} catch {
  binary = join('..', 'node_modules', '.bin', process.platform === 'win32' ? 'oxlint.cmd' : 'oxlint')
}

console.log(`lint: ${files.length} files`)
const result = spawnSync(binary, ['-c', '.oxlintrc.json', ...files], { stdio: 'inherit', shell: binary.endsWith('.cmd') })
process.exit(result.status ?? 1)
