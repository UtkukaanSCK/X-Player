/**
 * What can actually be downloaded.
 *
 * The download section is driven entirely from here so it can never advertise a
 * file that does not exist. Nothing has been published yet: the app builds
 * locally and the Windows installer has been produced and run, but there is no
 * release to link to. Until `published` is true the section says so rather than
 * offering buttons that 404.
 *
 * To release: create the repository, run `npm run dist` on each platform, upload
 * the artefacts, then set `published: true` and correct any sizes that moved.
 */
export const APP_VERSION = '1.0.0'
export const APP_REPO = 'https://github.com/UtkukaanSCK/X-Player-App'
export const APP_RELEASES = `${APP_REPO}/releases`

/** Flip once a release exists with the assets named below. */
export const published = true

/*
 * Whether APP_REPO is a repository that exists.
 *
 * Separate from `published` because they became true at different times: the
 * download needs a release, the "build it from source" link needs only the
 * repository. While this was false the page still rendered that link, so the
 * one thing the desktop answer offered was a 404 - the exact failure the flag
 * above exists to prevent, missed because it was guarding the wrong link.
 *
 * The app's source is not on GitHub at all yet; it lives beside the player and
 * is gitignored from it.
 */
export const sourcePublished = true

export type PlatformId = 'windows' | 'macos' | 'linux'

export interface Download {
  id: PlatformId
  label: string
  /** What the file is, said plainly. */
  format: string
  file: string
  /** Measured from a real build where one exists, null where none has been run. */
  sizeMb: number | null
  /*
   * Whether this platform's asset is actually in the release.
   *
   * `published` is one flag for the whole section and that is not enough: the
   * first release carried Windows alone, so flipping it offered a .dmg and an
   * AppImage that were never built and answered 404. What is true per platform
   * has to be recorded per platform.
   */
  released: boolean
  /** True only where a build has actually been produced and launched. */
  verified: boolean
  note: string
}

export const DOWNLOADS: Download[] = [
  {
    id: 'windows',
    label: 'Windows',
    format: 'Installer (.exe)',
    file: `X-Player-${APP_VERSION}-Setup.exe`,
    sizeMb: 188,
    released: true,
    verified: true,
    note: 'Built and run. 64-bit, Windows 10 or later.',
  },
  {
    id: 'macos',
    label: 'macOS',
    format: 'Disk image (.dmg)',
    file: `X-Player-${APP_VERSION}-arm64.dmg`,
    sizeMb: null,
    released: false,
    verified: false,
    note: 'Apple silicon and Intel. Unsigned, so the first launch needs right-click then Open.',
  },
  {
    id: 'linux',
    label: 'Linux',
    format: 'AppImage and .deb',
    file: `X-Player-${APP_VERSION}-x64.AppImage`,
    sizeMb: null,
    released: false,
    verified: false,
    note: 'File associations register from the .deb; an AppImage needs desktop integration.',
  },
]

export const downloadUrl = (file: string) => `${APP_RELEASES}/download/v${APP_VERSION}/${file}`

/**
 * A guess at which download to put first.
 *
 * Deliberately only a guess: the other two stay visible and equally reachable,
 * because platform detection from a user agent is wrong often enough that hiding
 * the alternatives would strand people.
 */
export function guessPlatform(userAgent: string): PlatformId | null {
  const ua = userAgent.toLowerCase()
  if (ua.includes('windows')) return 'windows'
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos'
  if (ua.includes('linux') && !ua.includes('android')) return 'linux'
  return null
}
