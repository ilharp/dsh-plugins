import { open, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

export type PackageManagerName = 'npm' | 'yarn' | 'pnpm'

export type DetectionSignal = 'field' | 'lockfile' | 'default'

export interface PackageManagerDetection {
  pm: PackageManagerName
  version?: string | undefined
  yarnV1: boolean
  signal: DetectionSignal
}

export interface InstallPlan {
  command: string
  args: string[]
  env?: Record<string, string>
}

// Corepack Known Good Release used when a v1 yarn.lock pins the project but
// no version comes from a field signal.
const YARN_V1_FALLBACK_VERSION = '1.22.22'

const SUPPORTED_PMS: ReadonlySet<string> = new Set(['npm', 'yarn', 'pnpm'])

// CI defaults freeze the lockfile for pnpm and yarn berry; npm i auto-updates,
// so align by disabling the freeze (evaluator.md §4.5). yarn v1 has no
// --no-immutable.
const PM_INSTALL_FLAGS: Record<PackageManagerName, readonly string[]> = {
  npm: [],
  pnpm: ['--no-frozen-lockfile'],
  yarn: ['--no-immutable'],
}

interface FieldSignal {
  pm: PackageManagerName
  version?: string | undefined
}

// Keep `version` absent (not an explicit undefined) when there is none.
const toFieldSignal = (
  pm: PackageManagerName,
  version: string | undefined,
): FieldSignal => (version === undefined ? { pm } : { pm, version })

interface LockfileSignal {
  file: string
  pm: PackageManagerName
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isMissing = (error: unknown): boolean =>
  isRecord(error) && error['code'] === 'ENOENT'

// `packageManager` is `<name>@<version>` (version may carry a `+sha512…` hash
// or be a range). Values that do not name a supported pm (bun, URL/tgz forms)
// yield no signal; the caller logs and falls through to the next signal.
const parsePackageManagerField = (value: unknown): FieldSignal | undefined => {
  if (typeof value !== 'string') return undefined
  const at = value.indexOf('@', 1)
  if (at <= 0) return undefined
  const name = value.slice(0, at)
  if (!SUPPORTED_PMS.has(name)) return undefined
  const version = value.slice(at + 1).trim()
  return toFieldSignal(
    name as PackageManagerName,
    version === '' ? undefined : version,
  )
}

// devEngines.packageManager only counts in its object form `{ name, version? }`.
const parseDevEnginesField = (value: unknown): FieldSignal | undefined => {
  if (!isRecord(value)) return undefined
  const name = value['name']
  if (typeof name !== 'string' || !SUPPORTED_PMS.has(name)) return undefined
  const rawVersion = value['version']
  const version =
    typeof rawVersion === 'string' && rawVersion.trim() !== ''
      ? rawVersion.trim()
      : undefined
  return toFieldSignal(name as PackageManagerName, version)
}

const logIgnoredField = (field: string, value: unknown): void => {
  console.log(
    `[evaluator] packageManager: ignoring unsupported ${field} value: ${String(value)}`,
  )
}

const readRootManifest = async (repository: string): Promise<unknown> => {
  try {
    return JSON.parse(
      await readFile(resolve(repository, 'package.json'), 'utf8'),
    )
  } catch (error) {
    if (isMissing(error) || error instanceof SyntaxError) return undefined
    throw error
  }
}

const readFieldSignal = async (
  repository: string,
): Promise<FieldSignal | undefined> => {
  const manifest = await readRootManifest(repository)
  if (!isRecord(manifest)) return undefined

  if (manifest['packageManager'] !== undefined) {
    const direct = parsePackageManagerField(manifest['packageManager'])
    if (direct) return direct
    logIgnoredField('packageManager', manifest['packageManager'])
    return undefined
  }

  const devEngines = manifest['devEngines']
  if (!isRecord(devEngines) || devEngines['packageManager'] === undefined) {
    return undefined
  }
  const fromDevEngines = parseDevEnginesField(devEngines['packageManager'])
  if (fromDevEngines) return fromDevEngines
  logIgnoredField('devEngines.packageManager', devEngines['packageManager'])
  return undefined
}

// Ordered by priority; the first lockfile found in the repository root wins.
const LOCKFILE_SIGNALS: readonly LockfileSignal[] = [
  { file: 'pnpm-lock.yaml', pm: 'pnpm' },
  { file: 'yarn.lock', pm: 'yarn' },
  { file: 'package-lock.json', pm: 'npm' },
  { file: 'npm-shrinkwrap.json', pm: 'npm' },
]

// Berry lockfiles start with a `__metadata:` block; v1 ones do not.
const hasYarnBerryMetadata = async (lockfile: string): Promise<boolean> => {
  const handle = await open(lockfile, 'r')
  try {
    const buffer = Buffer.alloc(4096)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    return buffer.subarray(0, bytesRead).includes('__metadata:')
  } finally {
    await handle.close()
  }
}

const readLockfileSignal = async (
  repository: string,
): Promise<(FieldSignal & { yarnV1: boolean }) | undefined> => {
  for (const { file, pm } of LOCKFILE_SIGNALS) {
    const path = resolve(repository, file)
    try {
      await stat(path)
    } catch (error) {
      if (isMissing(error)) continue
      throw error
    }
    const yarnV1 = pm === 'yarn' && !(await hasYarnBerryMetadata(path))
    return { pm, yarnV1 }
  }
  return undefined
}

// The first number in the version is the major; `1.…` pins yarn v1.
const isYarnV1Version = (version: string | undefined): boolean =>
  version !== undefined && /(\d+)/.exec(version)?.[1] === '1'

export const detectPackageManager = async (
  repository: string,
): Promise<PackageManagerDetection> => {
  const field = await readFieldSignal(repository)
  if (field) {
    return {
      ...field,
      yarnV1: field.pm === 'yarn' && isYarnV1Version(field.version),
      signal: 'field',
    }
  }

  const lockfile = await readLockfileSignal(repository)
  if (lockfile) return { ...lockfile, signal: 'lockfile' }
  return { pm: 'npm', yarnV1: false, signal: 'default' }
}

export const resolveInstallPlan = (
  detection: PackageManagerDetection,
): InstallPlan => {
  const { pm, version, yarnV1 } = detection

  if (pm === 'npm' && !version) return { command: 'npm', args: ['i'] }

  // A pinned pm (including npm) always runs through corepack, one path for all.
  const label = version === undefined ? pm : `${pm}@${version}`
  const args = [label, 'install']

  // A v1 lockfile without a field version installs with the pinned v1 Known
  // Good Release instead of the KGR default.
  if (pm === 'yarn' && !version && yarnV1) {
    return {
      command: 'corepack',
      args: [`yarn@${YARN_V1_FALLBACK_VERSION}`, 'install'],
    }
  }
  // yarn v1 does not know --no-immutable; only berry unfreezes via flags.
  if (pm === 'pnpm' || (pm === 'yarn' && !yarnV1)) {
    args.push(...PM_INSTALL_FLAGS[pm])
  }

  const plan: InstallPlan = { command: 'corepack', args }
  if (pm === 'pnpm') {
    plan.env = { npm_config_dangerously_allow_all_builds: 'true' }
  }
  return plan
}
