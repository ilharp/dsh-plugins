import type { PluginData } from './plugins'

export const installCommand = (plugin: PluginData): string | undefined => {
  if (plugin.npm) {
    return `dsh plugin --profile web add ${plugin.npm.name}`
  }

  if (plugin.github) {
    return `dsh plugin --profile web add github:${plugin.github.owner}/${plugin.github.repo}`
  }

  return undefined
}
