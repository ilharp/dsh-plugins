import {
  highlightName,
  isSearchReady,
  preloadSearch,
  searchPlugins,
} from './client-search'

export interface SearchUIOptions {
  input: HTMLInputElement
  status: HTMLElement
  list: HTMLElement
  empty: HTMLElement
  rowTemplate: HTMLTemplateElement
  prev: HTMLButtonElement
  next: HTMLButtonElement
  pageLabel: HTMLElement
  pageSize: number
  initialQuery?: string
  initialPage?: number
  onStateChange?: (query: string, page: number) => void
}

export interface SearchUI {
  /** Warm the index (call when the search surface becomes visible). */
  preload: () => void
  /** Execute a query immediately. */
  run: (query: string, page?: number) => void
}

const DEBOUNCE_MS = 150

export const initSearchUI = (options: SearchUIOptions): SearchUI => {
  const {
    input,
    status,
    list,
    empty,
    rowTemplate,
    prev,
    next,
    pageLabel,
    pageSize,
    onStateChange,
  } = options

  let hits: Awaited<ReturnType<typeof searchPlugins>> = []
  let page = 1
  let pageCount = 1
  let timer: ReturnType<typeof setTimeout> | undefined

  const setStatus = (text: string): void => {
    status.textContent = text
  }

  const renderRow = (
    doc: { id: number; name: string; npm?: string; repo?: string },
    terms: string[],
  ): Node => {
    const fragment = rowTemplate.content.cloneNode(true) as DocumentFragment
    const row = fragment.querySelector('[data-row]')
    if (!(row instanceof HTMLAnchorElement))
      return document.createDocumentFragment()
    row.href = `/plugins/${doc.id}`
    const id = fragment.querySelector('[data-id]')
    const name = fragment.querySelector('[data-name]')
    const sub = fragment.querySelector('[data-sub]')
    const pack = fragment.querySelector('[data-package]')
    if (id) id.textContent = `#${doc.id}`
    if (name) name.innerHTML = highlightName(doc.name, terms)
    if (sub) {
      const subtitle = doc.repo ?? doc.npm
      if (subtitle) sub.textContent = subtitle
      else sub.remove()
    }
    if (pack) pack.textContent = doc.npm ?? 'GitHub 来源'
    return fragment
  }

  const render = (): void => {
    pageCount = Math.max(1, Math.ceil(hits.length / pageSize))
    page = Math.min(Math.max(1, page), pageCount)
    list.replaceChildren()
    for (const hit of hits.slice((page - 1) * pageSize, page * pageSize)) {
      list.append(renderRow(hit.doc, hit.matchedTerms))
    }
    const hasResults = hits.length > 0
    list.hidden = !hasResults
    empty.hidden = hasResults
    const emptyQuery = empty.querySelector('[data-empty-query]')
    if (emptyQuery) emptyQuery.textContent = input.value.trim()
    prev.disabled = page <= 1
    next.disabled = page >= pageCount
    pageLabel.textContent = `第 ${page} / ${pageCount} 页`
  }

  const execute = async (query: string, keepPage = false): Promise<void> => {
    const terms = query.trim()
    if (terms.length === 0) {
      hits = []
      page = 1
      render()
      setStatus('输入关键词开始搜索')
      onStateChange?.('', 1)
      return
    }

    if (!isSearchReady()) setStatus('搜索索引加载中…')
    try {
      hits = await searchPlugins(terms)
    } catch {
      hits = []
      render()
      setStatus('搜索索引加载失败，请重试。')
      return
    }
    if (!keepPage) page = 1
    render()
    setStatus(`${hits.length.toLocaleString()} 条结果`)
    onStateChange?.(terms, page)
  }

  const ui: SearchUI = {
    preload: () => {
      void preloadSearch()
    },
    run: (query, targetPage = 1) => {
      page = targetPage
      void execute(query)
    },
  }

  input.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(() => void execute(input.value), DEBOUNCE_MS)
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      clearTimeout(timer)
      void execute(input.value)
    }
  })
  prev.addEventListener('click', () => {
    if (page > 1) {
      page -= 1
      render()
      setStatus(`${hits.length.toLocaleString()} 条结果`)
      onStateChange?.(input.value.trim(), page)
    }
  })
  next.addEventListener('click', () => {
    if (page < pageCount) {
      page += 1
      render()
      setStatus(`${hits.length.toLocaleString()} 条结果`)
      onStateChange?.(input.value.trim(), page)
    }
  })

  if (options.initialQuery) {
    input.value = options.initialQuery
    page = Math.max(1, options.initialPage ?? 1)
    void execute(options.initialQuery, true)
  } else {
    render()
    setStatus('输入关键词开始搜索')
  }

  return ui
}
