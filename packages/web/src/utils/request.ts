import type { DpResponseBody } from '@/typedef'

/**
 * A dp-server envelope failure. `code` mirrors the envelope: 400 invalid
 * parameter, 404 not found, 500 internal error. Pages map 404 to the
 * not-found page via `isApiNotFound` and let everything else propagate,
 * which renders the error page.
 */
export class ApiError extends Error {
  code: number

  constructor(code: number, msg: string) {
    super(msg)
    this.code = code
  }
}

export function isApiNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.code === 404
}

/**
 * Request one dp-server endpoint and unwrap the `{ code, data }` envelope.
 * `path` is the server route with its `/v1` prefix, e.g.
 * `/v1/plugin?page=2` — the same string the typedef route comments use.
 *
 * Everything speaks same-origin `/v1`: browsers resolve the path against
 * the page origin (k8s Gateway routes `/v1/*` straight to dp-server in
 * production; Next dev proxies it via rewrites). Server-side rendering
 * must pass `origin` (see `originFrom`) because Node cannot fetch a
 * relative URL — in dev that targets the Next server itself and lands in
 * the same rewrite; in production it targets the public origin and rides
 * the Gateway like a browser. Envelope failures throw `ApiError`; a
 * non-200 HTTP answer means the response never carried an envelope
 * (router fallback or transport failure) and is reported as 500.
 */
export async function request<T>(path: string, origin?: string): Promise<T> {
  const res = await fetch(origin === undefined ? path : `${origin}${path}`)
  if (!res.ok) throw new ApiError(500, `dp-server answered HTTP ${res.status}`)
  const body = (await res.json()) as DpResponseBody<T>
  if (body.code === 200) return body.data as T
  throw new ApiError(body.code, body.msg ?? 'internal error')
}
