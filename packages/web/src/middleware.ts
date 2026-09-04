import { getPlugins, isRedirect, pluginId } from '@/lib/plugins'
import { pluginUrl } from '@/lib/urls'
import { defineMiddleware } from 'astro:middleware'

let redirectsPromise: Promise<Map<number, number>> | undefined

const getRedirects = (): Promise<Map<number, number>> => {
  redirectsPromise ??= getPlugins().then((entries) => {
    const redirects = new Map<number, number>()
    for (const entry of entries) {
      if (isRedirect(entry.data))
        redirects.set(pluginId(entry), entry.data.redirect)
    }
    return redirects
  })
  return redirectsPromise
}

export const onRequest = defineMiddleware(async (context, next) => {
  const match = /^\/plugins\/(\d+)$/.exec(context.url.pathname)
  if (match) {
    const target = (await getRedirects()).get(Number(match[1]))
    if (target) {
      return new Response(null, {
        status: 301,
        headers: {
          location: pluginUrl(target),
          // Short TTL: a mistaken redirect heals itself instead of being
          // pinned in browsers indefinitely, as unqualified 301s can be.
          'cache-control': 'public, max-age=600',
        },
      })
    }
  }
  return next()
})
