import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
    root: '.',
    base: './',
    publicDir: 'public',
    build: {
        outDir: 'dist',
    }
}))
