// Trigger-side resolver for the eval job: turns a numeric plugin id into the
// git URL and plugin path the evaluator image expects, read straight from the
// dataset at the current checkout. Same package and same js-yaml dialect as
// publish, so the dataset has exactly one parser. The resolver stays quiet —
// it writes one JSON object to the output file given as the second argument;
// the [eval] narration belongs to the workflow. Errors end with one FAILED:
// line, same shape as publish.
import { readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'

type JsonObject = Record<string, unknown>

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const main = async (): Promise<void> => {
  const [, , rawId, outFile] = process.argv
  if (
    typeof rawId !== 'string' ||
    rawId.trim() === '' ||
    typeof outFile !== 'string' ||
    outFile.trim() === ''
  )
    throw new Error('usage: resolve <plugin-id> <out-file>')
  const id = rawId.trim()
  if (!/^\d+$/.test(id))
    throw new Error(`plugin id must be numeric, got "${id}"`)

  // yarn runs workspace scripts with the package directory as cwd, so the repo
  // root is derived from this file's location (packages/publish/src/), not cwd.
  const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
  const datasetPath = join(
    repoRoot,
    'packages',
    'web',
    'src',
    'plugins',
    id,
    'index.yml',
  )
  let raw: string
  try {
    raw = await readFile(datasetPath, 'utf8')
  } catch (error) {
    if (isObject(error) && error['code'] === 'ENOENT')
      throw new Error(
        `plugin ${id} not found (${relative(repoRoot, datasetPath)})`,
      )
    throw error
  }
  let document: unknown
  try {
    document = load(raw)
  } catch (cause) {
    throw new Error(`${datasetPath} is not valid YAML`, { cause })
  }
  if (!isObject(document))
    throw new Error(`${datasetPath} must contain a mapping`)
  const github = document['github']
  if (!isObject(github)) throw new Error(`plugin ${id} has no github identity`)
  const owner = github['owner']
  const repo = github['repo']
  if (
    typeof owner !== 'string' ||
    owner.trim() === '' ||
    typeof repo !== 'string' ||
    repo.trim() === ''
  )
    throw new Error(`plugin ${id} has no github identity`)
  // Missing or root-valued path means the repository root, matching DPEVAL_PATH
  // semantics; anything else is passed through as stored.
  const rawPath = github['path']
  const path =
    typeof rawPath === 'string' &&
    rawPath.trim() !== '' &&
    rawPath.trim() !== '.'
      ? rawPath.trim()
      : '.'
  await writeFile(
    outFile,
    JSON.stringify({
      id,
      owner,
      repo,
      path,
      git: `https://github.com/${owner}/${repo}.git`,
    }),
    'utf8',
  )
}

await main().catch((error: unknown) => {
  console.error(
    `FAILED: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exitCode = 1
})
