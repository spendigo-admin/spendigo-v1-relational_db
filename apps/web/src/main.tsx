import { initSentry } from './lib/sentry'
initSentry();

import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './styles/reset.css'
import './styles/design-system.css'
import './styles/themes.css'
import './i18n'
import { initTheme } from './components/ThemeSwitcher'

initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <HelmetProvider>
            <App />
        </HelmetProvider>
    </React.StrictMode>,
)
