export interface NekoilResponseBody<T> {
  code: number
  data?: T | undefined
  msg?: string | undefined
}

export interface DatabaseBase {
  created_time: number
  updated_time: number
}
