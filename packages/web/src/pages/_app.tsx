import type { AppProps } from 'next/app'
import { ThemeProvider } from 'next-themes'

import '../styles/index.scss'
import '../styles/tw.css'

const App = ({ Component, pageProps }: AppProps) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Component {...pageProps} />
    </ThemeProvider>
  )
}

export default App
