/**
 * Response envelope of dp-server. Success carries `{ code: 200, data }`;
 * failure carries `{ code, msg }`. Both are served with HTTP status 200
 * (the router fallback answers a bare 404 with an empty body).
 */
export interface DpResponseBody<T> {
  code: number
  data?: T | undefined
  msg?: string | undefined
}
