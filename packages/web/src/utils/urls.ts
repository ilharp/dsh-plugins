import type { PluginData } from './plugins'

const segment = (value: string): string => encodeURIComponent(value)

export const pluginUrl = (id: number): string => `/plugins/${id}`

export const githubRoute = (
  github: NonNullable<PluginData['github']>,
): string => `/${segment(github.owner)}/${segment(github.repo)}`

export const githubUrl = (
  github: NonNullable<PluginData['github']>,
): string => {
  const repository = `https://github.com/${segment(github.owner)}/${segment(github.repo)}`
  if (!github.path) return repository
  return `${repository}/tree/HEAD/${github.path
    .split('/')
    .map(segment)
    .join('/')}`
}

// npm names are restricted to [A-Za-z0-9._@/-]; the @ of scoped packages must
// stay raw so routes match the on-disk page directories and npmjs URL style.
export const npmRoute = (name: string): string => `/package/${name}`

export const npmUrl = (name: string): string =>
  `https://www.npmjs.com/package/${name}`

export const postUrl = (id: string): string => `/p/${id}`
