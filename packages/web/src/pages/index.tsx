import { ArrowRightIcon, SearchIcon } from 'lucide-react'
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Layout } from '@/layouts/Layout'
import { ApiError, request } from '@/utils/request'
import { originFrom } from '@/utils/origin'
import type { PluginListData } from '@/typedef'
import styles from './index.module.scss'

const pageUrl = (target: number): string => (target > 1 ? `/?page=${target}` : '/')

const Home = ({ list }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const pageCount = Math.max(1, Math.ceil(list.total / list.pageSize))
  const pageNumbers = Array.from(
    new Set(
      [1, list.page - 1, list.page, list.page + 1, pageCount].filter(
        (value) => value >= 1 && value <= pageCount,
      ),
    ),
  )

  return (
    <Layout description="在 DSH 插件索引中浏览 GitHub 仓库、npm 包与版本信息。">
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>DSH 插件索引</h1>
            <p className={styles.intro}>统一收录插件的包名、仓库来源与版本兼容信息。</p>
          </div>
          <div className={styles.count} aria-label={`已收录 ${list.total} 个插件`}>
            <strong>{list.total.toLocaleString('en-US')}</strong>
            个已收录插件
          </div>
        </header>

        <div className={styles.searchTrigger}>
          <a className={styles.searchButton} href="/search">
            <SearchIcon aria-hidden="true" />
            搜索插件
            <kbd className={styles.kbd} aria-hidden="true">
              /
            </kbd>
          </a>
        </div>

        <section aria-labelledby="results-heading">
          <div className={styles.resultsHeader}>
            <h2 id="results-heading" className={styles.resultsTitle}>
              全部插件
            </h2>
            <span className={styles.resultCount}>
              共 {list.total.toLocaleString('en-US')} 个插件 · 第 {list.page} / {pageCount} 页
            </span>
          </div>

          {list.items.length > 0 ? (
            <div className={styles.list}>
              {list.items.map((item) => (
                <a className={styles.row} key={item.id} href={`/plugins/${item.id}`}>
                  <span className={styles.id}>#{item.id}</span>
                  <span className={styles.nameBlock}>
                    <span className={styles.name}>{item.name}</span>
                    {item.owner !== null && item.repo !== null && (
                      <span className={styles.repository}>
                        {item.owner}/{item.repo}
                        {item.githubPath !== null ? `/${item.githubPath}` : ''}
                      </span>
                    )}
                  </span>
                  <span className={styles.package}>{item.npmName ?? 'GitHub 来源'}</span>
                  <span className={styles.version}>
                    {item.latestPackageVersion === null ? '暂无版本' : `v${item.latestPackageVersion}`}
                  </span>
                  <ArrowRightIcon className={styles.arrow} aria-hidden="true" />
                </a>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <h3 className={styles.emptyTitle}>还没有收录任何插件</h3>
            </div>
          )}
        </section>

        {pageCount > 1 && (
          <Pagination className={styles.pagination}>
            <PaginationContent>
              {list.page > 1 && (
                <PaginationItem>
                  <PaginationPrevious
                    aria-label="上一页"
                    href={pageUrl(list.page - 1)}
                    text="上一页"
                  />
                </PaginationItem>
              )}
              {pageNumbers.map((number) => (
                <PaginationItem key={number}>
                  <PaginationLink href={pageUrl(number)} isActive={number === list.page}>
                    {number}
                  </PaginationLink>
                </PaginationItem>
              ))}
              {list.page < pageCount && (
                <PaginationItem>
                  <PaginationNext
                    aria-label="下一页"
                    href={pageUrl(list.page + 1)}
                    text="下一页"
                  />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps<{ list: PluginListData }> = async ({
  req,
  query,
}) => {
  const rawPage = query.page
  // Missing param renders page 1; anything that is not a plain integer
  // >= 1 has no page to show (the old site clamped; the API is strict
  // per Q14).
  const page =
    rawPage === undefined
      ? 1
      : typeof rawPage === 'string' && /^\d+$/.test(rawPage) && Number(rawPage) >= 1
        ? Number(rawPage)
        : null
  if (page === null) return { notFound: true }

  try {
    const list = await request<PluginListData>(`/v1/plugin?page=${page}`, originFrom(req))
    return { props: { list } }
  } catch (error) {
    // Out-of-range pages (400) mean this URL has no page either; only
    // transport-level failures render the error page.
    if (error instanceof ApiError && (error.code === 400 || error.code === 404)) {
      return { notFound: true }
    }
    throw error
  }
}

export default Home
