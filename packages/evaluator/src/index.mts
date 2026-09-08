import { spawn } from 'node:child_process'
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

const RESULT_FILENAME = 'package-json-dsh-bundle-valid.json'
const PACKAGE_JSON_RESULT_FILENAME = 'package-json-valid.json'

interface EvaluatorOptions {
  env?: NodeJS.ProcessEnv
  root?: string
}

interface EvaluationResult {
  version: 1
  pass: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isWithin = (parent: string, child: string): boolean => {
  const path = relative(parent, child)
  return (
    path === '' ||
    (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path))
  )
}

const isMissing = (error: unknown): boolean =>
  isRecord(error) && error['code'] === 'ENOENT'

const repositoryName = (git: string): string => {
  const source = git.replace(/[\\/]+$/, '')
  const separator = Math.max(source.lastIndexOf('/'), source.lastIndexOf(':'))
  const name = source.slice(separator + 1).replace(/\.git$/i, '')
  if (!name || name === '.' || name === '..') {
    throw new Error(`cannot determine repository name from DPEVAL_GIT: ${git}`)
  }
  return name
}

const runCommand = async (
  command: string,
  args: string[],
  cwd: string,
): Promise<void> => {
  await new Promise<void>((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })
    child.once('error', rejectCommand)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveCommand()
        return
      }
      rejectCommand(
        new Error(
          `${command} ${args.join(' ')} failed${
            signal
              ? ` with signal ${signal}`
              : ` with exit code ${String(code)}`
          }`,
        ),
      )
    })
  })
}

const resolvePluginDirectory = async (
  repository: string,
  configuredPath: string | undefined,
): Promise<string> => {
  const path = configuredPath?.trim()
  if (!path || path === '.') return repository
  if (isAbsolute(path)) throw new Error('DPEVAL_PATH must be a relative path')

  const directory = resolve(repository, path)
  if (!isWithin(repository, directory)) {
    throw new Error('DPEVAL_PATH must stay within the cloned repository')
  }

  let metadata
  try {
    metadata = await stat(directory)
  } catch (error) {
    if (isMissing(error)) {
      throw new Error(`DPEVAL_PATH does not exist: ${path}`, { cause: error })
    }
    throw error
  }
  if (!metadata.isDirectory())
    throw new Error(`DPEVAL_PATH is not a directory: ${path}`)

  const [repositoryRealPath, directoryRealPath] = await Promise.all([
    realpath(repository),
    realpath(directory),
  ])
  if (!isWithin(repositoryRealPath, directoryRealPath)) {
    throw new Error('DPEVAL_PATH must stay within the cloned repository')
  }
  return directory
}

const readManifest = async (pluginDirectory: string): Promise<unknown> => {
  try {
    return JSON.parse(
      await readFile(resolve(pluginDirectory, 'package.json'), 'utf8'),
    )
  } catch (error) {
    if (isMissing(error) || error instanceof SyntaxError) return undefined
    throw error
  }
}

const writeResult = async (
  resultsDirectory: string,
  filename: string,
  pass: boolean,
): Promise<void> => {
  const result: EvaluationResult = { version: 1, pass }
  await writeFile(
    resolve(resultsDirectory, filename),
    `${JSON.stringify(result)}\n`,
    'utf8',
  )
}

const evaluateBundle = async (
  pluginDirectory: string,
  manifest: unknown,
): Promise<boolean> => {
  if (!isRecord(manifest) || !isRecord(manifest['dsh'])) return false
  const bundle = manifest['dsh']['bundle']
  if (!isRecord(bundle)) return false
  const patch = bundle['patch']
  if (typeof patch !== 'string' || patch.trim() === '' || isAbsolute(patch)) {
    return false
  }

  const patchPath = resolve(pluginDirectory, patch)
  if (!isWithin(pluginDirectory, patchPath)) return false

  try {
    const [pluginRealPath, patchRealPath, metadata] = await Promise.all([
      realpath(pluginDirectory),
      realpath(patchPath),
      stat(patchPath),
    ])
    return isWithin(pluginRealPath, patchRealPath) && metadata.isFile()
  } catch (error) {
    if (isMissing(error)) return false
    throw error
  }
}

export const runEvaluator = async (
  options: EvaluatorOptions = {},
): Promise<void> => {
  const env = options.env ?? process.env
  const root = options.root ?? '/evalenv'
  const git = env['DPEVAL_GIT']?.trim()
  if (!git) throw new Error('DPEVAL_GIT is required')

  const resultsDirectory = resolve(root, 'results')
  await mkdir(resultsDirectory, { recursive: true })

  const repository = resolve(root, repositoryName(git))
  await runCommand('git', ['clone', git, repository], root)

  const pluginDirectory = await resolvePluginDirectory(
    repository,
    env['DPEVAL_PATH'],
  )

  const manifest = await readManifest(pluginDirectory)
  const canInstall = isRecord(manifest)
  await writeResult(resultsDirectory, PACKAGE_JSON_RESULT_FILENAME, canInstall)
  if (canInstall) await runCommand('npm', ['i'], pluginDirectory)

  await writeResult(
    resultsDirectory,
    RESULT_FILENAME,
    canInstall && (await evaluateBundle(pluginDirectory, manifest)),
  )

  // TODO: Implement dynamic evaluation.
}

await runEvaluator()
