import { getBlogs } from '@/lib/blogs'
import { getCanonicalPlugins, pluginId } from '@/lib/plugins'
import { blogUrl, githubRoute, npmRoute, pluginUrl } from '@/lib/urls'
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
  const blogs = await getBlogs()
  const paths = new Set<string>(['/', '/search', '/blog'])

  for (const entry of plugins) {
    paths.add(pluginUrl(pluginId(entry)))
    if (entry.data.npm) paths.add(npmRoute(entry.data.npm.name))
    if (entry.data.github) paths.add(githubRoute(entry.data.github))
  }
  for (const post of blogs) paths.add(blogUrl(post.id))

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
