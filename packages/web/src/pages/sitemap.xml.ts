import { getCanonicalPlugins, pluginId } from '@/lib/plugins'
import { getPosts } from '@/lib/posts'
import { githubRoute, npmRoute, pluginUrl, postUrl } from '@/lib/urls'
import type { APIRoute } from 'astro'

export const prerender = true

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

export const GET: APIRoute = async ({ site }) => {
  const plugins = await getCanonicalPlugins()
  const posts = await getPosts()
  const paths = new Set<string>(['/', '/search', '/posts'])

  for (const entry of plugins) {
    paths.add(pluginUrl(pluginId(entry)))
    if (entry.data.npm) paths.add(npmRoute(entry.data.npm.name))
    if (entry.data.github) paths.add(githubRoute(entry.data.github))
  }
  for (const post of posts) paths.add(postUrl(post.id))

  const body = [...paths]
    .sort()
    .map(
      (path) => `<url><loc>${escapeXml(new URL(path, site).href)}</loc></url>`,
    )
    .join('')

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`,
    {
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    },
  )
}
