import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
    plugins: [
        react(),
        command === 'serve' ? basicSsl({
            name: 'spendigo',
            domains: ['spendigo.ca', 'www.spendigo.ca', 'localhost'],
            // Use relative path or omit certDir to avoid hardcoded absolute paths that break CI
            certDir: './.certs'
        }) : []
    ],
    server: {
        host: 'spendigo.ca',
        port: 443,
        hmr: {
            host: 'spendigo.ca'
        }
    }
}))

