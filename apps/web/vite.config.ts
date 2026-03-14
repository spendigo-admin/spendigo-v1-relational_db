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
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions', 'firebase/analytics'],
                    'vendor-algolia': ['algoliasearch'],
                    'vendor-stripe': ['@stripe/stripe-js'],
                    'vendor-ai': ['@google/generative-ai'],
                }
            }
        },
        // Strip all console.* calls in production builds
        minify: 'esbuild',
        esbuildOptions: {
            drop: ['console', 'debugger'],
        }
    }
}))
