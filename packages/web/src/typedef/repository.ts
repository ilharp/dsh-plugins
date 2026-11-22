import type { PluginListItem } from './plugin'

/**
 * GitHub repository facts. The `id` used to locate the row stays on the
 * server and is never serialized.
 */
export interface RepositoryData {
  owner: string
  repo: string
  /** SPDX license id; null when GitHub detects no license. */
  license: string | null
  stars: number | null
  forks: number | null
  openIssues: number | null
}

/** Payload of `GET /v1/repo/{owner}/{repo}`. */
export interface RepoData {
  repository: RepositoryData
  plugins: PluginListItem[]
}
