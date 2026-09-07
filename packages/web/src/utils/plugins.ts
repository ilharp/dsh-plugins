import { getCollection, type CollectionEntry } from 'astro:content'

export type PluginEntry = CollectionEntry<'plugin'>
export type PluginData = Exclude<PluginEntry['data'], { redirect: number }>
export type RedirectData = Extract<PluginEntry['data'], { redirect: number }>

let pluginsPromise: Promise<PluginEntry[]> | undefined

export const getPlugins = (): Promise<PluginEntry[]> => {
  pluginsPromise ??= getCollection('plugin')
  return pluginsPromise
}

export const isRedirect = (data: PluginEntry['data']): data is RedirectData =>
  'redirect' in data

export const isPlugin = (
  entry: PluginEntry,
): entry is PluginEntry & { data: PluginData } => !isRedirect(entry.data)

export const pluginId = (entry: PluginEntry): number => {
  const match = entry.id.match(/(?:^|\/)(\d+)(?:\/index)?$/)
  return match?.[1] ? Number(match[1]) : Number(entry.id)
}

export const getPluginById = async (
  id: number,
): Promise<PluginEntry | undefined> =>
  (await getPlugins()).find((entry) => pluginId(entry) === id)

export const getPluginByNpm = async (
  name: string,
): Promise<(PluginEntry & { data: PluginData }) | undefined> =>
  (await getPlugins()).find(
    (entry): entry is PluginEntry & { data: PluginData } =>
      isPlugin(entry) &&
      entry.data.npm?.name.toLowerCase() === name.toLowerCase(),
  )

export const getPluginsByRepository = async (
  owner: string,
  repo: string,
): Promise<Array<PluginEntry & { data: PluginData }>> =>
  (await getPlugins()).filter(
    (entry): entry is PluginEntry & { data: PluginData } =>
      isPlugin(entry) &&
      entry.data.github?.owner.toLowerCase() === owner.toLowerCase() &&
      entry.data.github.repo.toLowerCase() === repo.toLowerCase(),
  )

export const getCanonicalPlugins = async (): Promise<
  Array<PluginEntry & { data: PluginData }>
> => (await getPlugins()).filter(isPlugin)
