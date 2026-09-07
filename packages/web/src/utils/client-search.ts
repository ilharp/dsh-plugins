import type { SearchResult } from 'minisearch'

export interface SearchDoc {
  id: number
  name: string
  npm?: string
  repo?: string
}

export interface SearchHit {
  doc: SearchDoc
  matchedTerms: string[]
}

type Engine = { search: (query: string) => SearchHit[] }

let enginePromise: Promise<Engine> | undefined

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const load = (): Promise<Engine> => {
  enginePromise ??= (async () => {
    const [miniSearchModule, response] = await Promise.all([
      import('minisearch'),
      fetch('/search-index.json'),
    ])
    if (!response.ok)
      throw new Error(`Index request failed: ${response.status}`)
    const docs = (await response.json()) as SearchDoc[]
    const store = new Map<number, SearchDoc>(docs.map((doc) => [doc.id, doc]))

    const index = new miniSearchModule.default({
      fields: ['name', 'npm', 'repo'],
      processTerm: (term: string) =>
        term.length >= 2 ? term.toLowerCase() : null,
    })
    index.addAll(docs)

    const searchOptions = {
      prefix: true,
      fuzzy: (term: string) => (term.length >= 4 ? 0.2 : false),
      boost: { name: 2, npm: 1.5, repo: 1 },
    }

    const toHits = (results: SearchResult[]): SearchHit[] =>
      results.flatMap((result) => {
        const doc = store.get(result.id as number)
        return doc ? [{ doc, matchedTerms: result.terms }] : []
      })

    return {
      search: (query: string): SearchHit[] => {
        const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
        if (terms.length === 0) return []

        const hits = toHits(
          index.search(query, { ...searchOptions, combineWith: 'AND' }),
        )
        const loose =
          hits.length > 0
            ? hits
            : toHits(
                index.search(query, {
                  ...searchOptions,
                  combineWith: 'OR',
                  fuzzy: 0.2,
                }),
              )

        const exact = terms.join(' ')
        return loose.sort((left, right) => {
          const leftExact = left.doc.name.toLowerCase() === exact ? 0 : 1
          const rightExact = right.doc.name.toLowerCase() === exact ? 0 : 1
          if (leftExact !== rightExact) return leftExact - rightExact
          return left.doc.id - right.doc.id
        })
      },
    }
  })()
  return enginePromise
}

/** Preload the index (used after the search UI becomes visible). */
export const preloadSearch = (): Promise<void> => load().then(() => undefined)

/** True once the index is ready; used to keep loading state honest. */
export const isSearchReady = (): boolean => enginePromise !== undefined

export const searchPlugins = async (query: string): Promise<SearchHit[]> =>
  (await load()).search(query)

/** Escape HTML, then wrap matched terms in <mark>. */
export const highlightName = (name: string, terms: string[]): string => {
  const escaped = name
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
  const useful = terms.filter((term) => term.length >= 2)
  if (useful.length === 0) return escaped
  const pattern = new RegExp(`(${useful.map(escapeRegExp).join('|')})`, 'gi')
  return escaped.replace(pattern, '<mark>$1</mark>')
}
