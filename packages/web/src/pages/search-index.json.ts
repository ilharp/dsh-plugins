import { getCanonicalPlugins, pluginId } from '@/lib/plugins'
import type { APIRoute } from 'astro'

export const GET: APIRoute = async () => {
  const plugins = await getCanonicalPlugins()
  const docs = plugins.map((entry) => ({
    id: pluginId(entry),
    name: entry.data.name,
    ...(entry.data.npm ? { npm: entry.data.npm.name } : {}),
    ...(entry.data.github
      ? {
          repo: `${entry.data.github.owner}/${entry.data.github.repo}${
            entry.data.github.path ? `/${entry.data.github.path}` : ''
          }`,
        }
      : {}),
  }))

  return new Response(JSON.stringify(docs), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
