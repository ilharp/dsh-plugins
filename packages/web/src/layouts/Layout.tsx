import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { ReactNode } from 'react'

import styles from './Layout.module.scss'
import { ThemeToggle } from '@/components/ThemeToggle'

const SITE_NAME = 'DSH Plugins'
const SITE_URL = 'https://dsh.ilharper.com'

const navItems = [
  { href: '/', label: '插件', isCurrent: (path: string) => path === '/' },
  {
    href: '/search',
    label: '搜索',
    isCurrent: (path: string) => path.startsWith('/search'),
  },
  {
    href: '/posts',
    label: '文章',
    isCurrent: (path: string) => path === '/posts' || path.startsWith('/p/'),
  },
] as const

type LayoutProps = {
  /** Page title; omitted or the site name renders the bare site name. */
  title?: string
  description: string
  /** Override for the canonical path; defaults to the router pathname. */
  canonicalPath?: string
  children: ReactNode
}

export const Layout = ({ title, description, canonicalPath, children }: LayoutProps) => {
  const { pathname } = useRouter()
  const pageTitle = !title || title === SITE_NAME ? SITE_NAME : `${title} · ${SITE_NAME}`
  const canonicalUrl = new URL(canonicalPath ?? pathname, SITE_URL).toString()

  return (
    <div className={styles.page}>
      <Head>
        <title>{pageTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        {/* Values mirror the background tokens of src/styles/tw.css. */}
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
      </Head>
      <a className={styles.skipLink} href="#main-content">
        跳到主要内容
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/" aria-label="DP — DSH Plugins 首页">
            <span className={styles.brandMark} aria-hidden="true">
              DP
            </span>
            <span className={styles.brandLabel}>DSH Plugins</span>
          </Link>
          <nav className={styles.nav} aria-label="主导航">
            {navItems.map((item) => (
              <Link
                key={item.href}
                className={styles.navLink}
                href={item.href}
                aria-current={item.isCurrent(pathname) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="main-content" className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>独立的 DSH 社区插件目录。</span>
          <a
            className={styles.footerLink}
            href="https://github.com/deepseek-ai/deepseek-harness"
          >
            DeepSeek Harness
          </a>
        </div>
      </footer>
    </div>
  )
}
