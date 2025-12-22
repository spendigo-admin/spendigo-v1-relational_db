import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        basicSsl({
            name: 'spendigo',
            domains: ['spendigo.ca', 'www.spendigo.ca', 'localhost'],
            certDir: '/Users/shahbaz/.gemini/antigravity/certs'
        })
    ],
    server: {
        host: 'spendigo.ca',
        port: 443
    }
})
