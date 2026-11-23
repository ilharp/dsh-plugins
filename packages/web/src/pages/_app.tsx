import type { AppProps } from 'next/app'

import '../styles/index.scss'
import '../styles/tw.css'

const App = ({ Component, pageProps }: AppProps) => {
  return <Component {...pageProps} />
}

export default App
