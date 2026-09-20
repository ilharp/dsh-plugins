import { dump, load } from 'js-yaml'
import { execFile } from 'node:child_process'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)

type JsonObject = Record<string, unknown>

interface Meta {
  git: string
  path?: string
  sha: string
  evaluator: string
}

interface Evaluation {
  version: number
  sha: string
  evaluatedAt: string
  evaluator: string
  results: Record<string, boolean>
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requiredString = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error(`meta.json field ${name} must be a non-empty string`)
  return value.trim()
}

const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, 'utf8')) as unknown

const githubIdentity = (git: string): { owner: string; repo: string } => {
  const match = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(git)
  if (!match?.[1] || !match[2])
    throw new Error(`DPEVAL_GIT is not a GitHub repository URL: ${git}`)
  return { owner: match[1], repo: match[2] }
}

// Key order in collected results maps is not stable across machines, so
// comparisons canonicalize entries before stringifying.
const canonical = (value: JsonObject): string =>
  JSON.stringify(
    Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  )

const same = (left: unknown, right: unknown): boolean =>
  isObject(left) && isObject(right) && canonical(left) === canonical(right)

const loadResults = async (
  directory: string,
): Promise<Record<string, boolean>> => {
  const results: Record<string, boolean> = {}
  const filenames = (await readdir(join(directory, 'results'))).sort()
  for (const filename of filenames) {
    if (!filename.endsWith('.json')) continue
    const key = filename.slice(0, -'.json'.length)
    const value = await readJson(join(directory, 'results', filename))
    if (
      !isObject(value) ||
      value['version'] !== 1 ||
      typeof value['pass'] !== 'boolean'
    )
      throw new Error(`invalid evaluation result: ${filename}`)
    results[key] = value['pass']
  }
  if (Object.keys(results).length === 0)
    throw new Error('no evaluation results found')
  return results
}

const findPlugin = async (
  repoRoot: string,
  owner: string,
  repo: string,
  configuredPath: string | undefined,
): Promise<{ id: string; path: string; document: JsonObject }> => {
  const pluginsRoot = join(repoRoot, 'packages', 'web', 'src', 'plugins')
  const matches: { id: string; path: string; document: JsonObject }[] = []
  for (const entry of await readdir(pluginsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue
    const path = join(pluginsRoot, entry.name, 'index.yml')
    try {
      const document = load(await readFile(path, 'utf8'))
      if (!isObject(document) || !isObject(document['github'])) continue
      const github = document['github']
      if (
        typeof github['owner'] !== 'string' ||
        typeof github['repo'] !== 'string' ||
        github['owner'].toLowerCase() !== owner.toLowerCase() ||
        github['repo'].toLowerCase() !== repo.toLowerCase()
      )
        continue
      if (
        configuredPath &&
        configuredPath !== '.' &&
        github['path'] !== configuredPath
      )
        continue
      matches.push({ id: entry.name, path, document })
    } catch {
      // Invalid collection documents are handled by the web build; ignore them here.
    }
  }
  if (matches.length !== 1)
    throw new Error(
      `expected exactly one plugin match, found ${matches.length} for ${owner}/${repo}`,
    )
  const match = matches[0]
  if (!match) throw new Error('plugin match disappeared')
  return match
}

const run = async (): Promise<void> => {
  const artifact = resolve(process.env['DPEVAL_ARTIFACT_DIR'] ?? process.cwd())
  let rawMeta: unknown
  try {
    rawMeta = await readJson(join(artifact, 'meta.json'))
  } catch (error) {
    if (isObject(error) && error['code'] === 'ENOENT')
      throw new Error(
        'meta.json is missing; the artifact belongs to a failed evaluation run and cannot be published',
        { cause: error },
      )
    throw error
  }
  if (!isObject(rawMeta)) throw new Error('meta.json must contain an object')
  const meta: Meta = {
    git: requiredString(rawMeta['git'], 'git'),
    sha: requiredString(rawMeta['sha'], 'sha'),
    evaluator: requiredString(rawMeta['evaluator'], 'evaluator'),
    ...(typeof rawMeta['path'] === 'string' && rawMeta['path'].trim() !== '.'
      ? { path: rawMeta['path'].trim() }
      : {}),
  }
  if (!/^[0-9a-f]{40}$/i.test(meta.sha))
    throw new Error('meta.json field sha must be a 40-character commit SHA')
  const { owner, repo } = githubIdentity(meta.git)
  const results = await loadResults(artifact)
  const repoRoot = resolve(process.env['GITHUB_WORKSPACE'] ?? process.cwd())
  const plugin = await findPlugin(repoRoot, owner, repo, meta.path)
  const evaluations = Array.isArray(plugin.document['evaluations'])
    ? plugin.document['evaluations'].filter(isObject)
    : []
  const evaluation: Evaluation = {
    version: 1,
    sha: meta.sha,
    evaluatedAt: new Date().toISOString(),
    evaluator: meta.evaluator,
    results,
  }
  const duplicate = evaluations.some(
    (item) =>
      item['version'] === evaluation.version &&
      item['sha'] === evaluation.sha &&
      item['evaluator'] === evaluation.evaluator &&
      same(item['results'], evaluation.results),
  )
  if (duplicate) {
    console.log(`[publish] evaluation already exists for plugin ${plugin.id}`)
    return
  }
  plugin.document['evaluations'] = [...evaluations, evaluation]
  await writeFile(
    plugin.path,
    dump(plugin.document, { lineWidth: -1, sortKeys: false }),
    'utf8',
  )

  const branch = `eval/plugin-${plugin.id}-${meta.sha.slice(0, 7)}`
  // -B reuses an existing branch (evaluator upgraded, same sha) instead of
  // failing on `checkout -b`; the branch is always rebuilt from master.
  await exec('git', ['checkout', '-B', branch], { cwd: repoRoot })
  await exec('git', ['add', plugin.path], { cwd: repoRoot })
  await exec(
    'git',
    ['commit', '-m', `chore: record evaluation for plugin ${plugin.id}`],
    { cwd: repoRoot },
  )
  await exec(
    'git',
    ['push', '--force-with-lease', '--set-upstream', 'origin', branch],
    { cwd: repoRoot },
  )
  const { stdout: openPrs } = await exec(
    'gh',
    ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number'],
    { cwd: repoRoot },
  )
  if (JSON.parse(openPrs).length > 0) {
    console.log(`[publish] open PR already exists for ${branch}`)
    return
  }
  const resultLines = Object.entries(results)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, pass]) => `- ${key}: ${pass ? 'pass' : 'fail'}`)
  const runUrl = process.env['DPEVAL_RUN_URL']
  const body = [
    `Automated evaluation for ${owner}/${repo} at ${meta.sha}.`,
    '',
    `- evaluator: \`${meta.evaluator}\``,
    `- sha: ${meta.sha}`,
    ...(meta.path ? [`- path: ${meta.path}`] : []),
    ...(runUrl ? [`- run: ${runUrl}`] : []),
    '',
    ...resultLines,
  ].join('\n')
  await exec(
    'gh',
    [
      'pr',
      'create',
      '--base',
      'master',
      '--head',
      branch,
      '--title',
      `chore: evaluate plugin ${plugin.id}`,
      '--body',
      body,
    ],
    { cwd: repoRoot },
  )
}

await run()
