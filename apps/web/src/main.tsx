import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/reset.css'
import './styles/design-system.css'
import './styles/themes.css'
import './i18n'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
