import { dump, load } from 'js-yaml'
import { execFile } from 'node:child_process'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

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

const formatDuration = (ms: number): string =>
  ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`

// One log line per completed fact; the last line printed marks how far a
// failed run got. Per-item result values are never logged (the list will
// grow to hundreds of items) — only the file count here and the PR body.
const log = (message: string, startedAt: number): void =>
  console.log(
    `[publish] ${message} (${formatDuration(Date.now() - startedAt)})`,
  )

const exec = async (
  command: string,
  args: string[],
  options: { cwd: string },
): Promise<{ stdout: string }> => {
  try {
    return await promisify(execFile)(command, args, options)
  } catch (error) {
    if (isObject(error)) {
      const output = [error['stderr'], error['stdout']]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value !== '')
        .join('\n')
      const tail = output ? `\n${output.split('\n').slice(-10).join('\n')}` : ''
      throw new Error(
        `${command} ${args.join(' ')} failed${tail ? `:${tail}` : ''}`,
        { cause: error },
      )
    }
    throw error
  }
}

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
  let startedAt = Date.now()
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
  log(
    `artifact: ${artifact} (results: ${Object.keys(results).length} files, meta: ok)`,
    startedAt,
  )

  startedAt = Date.now()
  log(
    `meta: ${owner}/${repo} @ ${meta.sha} (evaluator: ${meta.evaluator}${
      meta.path ? `, path: ${meta.path}` : ''
    })`,
    startedAt,
  )

  startedAt = Date.now()
  const repoRoot = resolve(process.env['GITHUB_WORKSPACE'] ?? process.cwd())
  const plugin = await findPlugin(repoRoot, owner, repo, meta.path)
  log(
    `match: plugin ${plugin.id} → ${relative(repoRoot, plugin.path)}`,
    startedAt,
  )

  startedAt = Date.now()
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
    log('dedup: already recorded, nothing to do', startedAt)
    return
  }
  log('dedup: new event', startedAt)

  startedAt = Date.now()
  plugin.document['evaluations'] = [...evaluations, evaluation]
  await writeFile(
    plugin.path,
    dump(plugin.document, { lineWidth: -1, sortKeys: false }),
    'utf8',
  )
  log(
    `yaml: evaluations ${evaluations.length} → ${evaluations.length + 1}`,
    startedAt,
  )

  const branch = `eval/plugin-${plugin.id}-${meta.sha.slice(0, 7)}`
  startedAt = Date.now()
  // -B reuses an existing branch (evaluator upgraded, same sha) instead of
  // failing on `checkout -b`; the branch is always rebuilt from master.
  await exec('git', ['checkout', '-B', branch], { cwd: repoRoot })
  // Fixed commit identity at repo level (never --global: publish may run on
  // a dev machine and must not touch the user's global git config).
  await exec('git', ['config', 'user.email', 'hi@ilharper.com'], {
    cwd: repoRoot,
  })
  await exec('git', ['config', 'user.name', 'Il Harper'], { cwd: repoRoot })
  log(`git: branch ${branch} rebuilt`, startedAt)

  startedAt = Date.now()
  await exec('git', ['add', plugin.path], { cwd: repoRoot })
  await exec(
    'git',
    ['commit', '-m', `chore: record evaluation for plugin ${plugin.id}`],
    { cwd: repoRoot },
  )
  log('git: committed', startedAt)

  startedAt = Date.now()
  await exec(
    'git',
    ['push', '--force-with-lease', '--set-upstream', 'origin', branch],
    { cwd: repoRoot },
  )
  log('git: pushed --force-with-lease', startedAt)

  startedAt = Date.now()
  const { stdout: openPrs } = await exec(
    'gh',
    ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number'],
    { cwd: repoRoot },
  )
  if (JSON.parse(openPrs).length > 0) {
    log('pr: open PR already exists, skipped', startedAt)
    return
  }
  log('pr: no open PR on branch', startedAt)

  startedAt = Date.now()
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
  const { stdout: created } = await exec(
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
  log(`pr: created ${created.trim().split('\n').pop() ?? ''}`, startedAt)
}

await run().catch((error: unknown) => {
  console.error(
    `[publish] FAILED: ${error instanceof Error ? error.message : String(error)}`,
  )
  if (error instanceof Error && error.stack) console.error(error.stack)
  process.exitCode = 1
})
