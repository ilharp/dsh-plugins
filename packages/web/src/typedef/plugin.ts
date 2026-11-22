import type { RepositoryData } from './repository'

/**
 * One row of the plugin listing. Shared with the repository page, which
 * lists a repository's plugins with the same projection.
 */
export interface PluginListItem {
  id: number
  name: string
  /** npm name; null when the plugin has no npm identity. */
  npmName: string | null
  /** Plugin path inside the repository; null = repository root. */
  githubPath: string | null
  /** Repository owner; null when no repository is linked. */
  owner: string | null
  repo: string | null
  /** Newest recorded package version (highest seq); null while no version exists. */
  latestPackageVersion: string | null
}

/** Payload of `GET /v1/plugin`: one page of the listing, newest plugin first. */
export interface PluginListData {
  total: number
  page: number
  pageSize: number
  items: PluginListItem[]
}

/**
 * One recorded `(package_version, dsh_version)` pair of a plugin; served
 * ordered by `seq` ascending, so the newest version is the last entry.
 */
export interface VersionRow {
  packageVersion: string
  dshVersion: string
}

/** One evaluation event of the plugin's append-only log. */
export interface EvaluationData {
  /** Record format version (currently 1). */
  version: number
  /** 40-hex commit sha the evaluation ran against. */
  sha: string
  /** When the evaluation ran: epoch milliseconds, UTC. */
  evaluatedAt: number
  /** Evaluator image tag that produced the results. */
  evaluator: string
  /** Kebab-case item key -> pass; key presence means the item was evaluated. */
  results: Record<string, boolean>
}

/**
 * Payload of `GET /v1/plugin/{id}` (also `GET /v1/package/{name}`): one
 * plugin with its repository, all versions (`seq` ascending) and all
 * evaluations (`evaluatedAt` ascending).
 */
export interface PluginDetailData {
  id: number
  name: string
  /** npm name; null when the plugin has no npm identity. */
  npmName: string | null
  /** Plugin path inside the repository; null = repository root. */
  githubPath: string | null
  /** Linked GitHub repository; null for npm-only plugins. */
  repository: RepositoryData | null
  versions: VersionRow[]
  evaluations: EvaluationData[]
}
