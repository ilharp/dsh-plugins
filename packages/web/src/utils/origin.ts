import type { IncomingMessage } from 'node:http'

/**
 * Reconstruct the request origin (`scheme://host`) from proxy headers.
 * dp-web always sits behind a proxy (Next dev, the k8s Gateway in
 * production), so `x-forwarded-proto` / `x-forwarded-host` carry the
 * client-facing origin; plain `host` is the fallback. Used to build
 * absolute URLs for server-side `fetch`, which Node cannot resolve from
 * a relative path.
 */
export function originFrom(req: IncomingMessage): string {
  const first = (value: string | string[] | undefined): string | undefined => {
    const raw = Array.isArray(value) ? value[0] : value
    return raw?.split(',')[0]?.trim() || undefined
  }
  const proto = first(req.headers['x-forwarded-proto']) ?? 'http'
  const host = first(req.headers['x-forwarded-host']) ?? first(req.headers['host'])
  if (!host) throw new Error('request carries no host header')
  return `${proto}://${host}`
}
