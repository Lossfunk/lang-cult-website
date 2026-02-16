import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
    root: '.',
    base: command === 'build' ? './' : '/',
    publicDir: 'public',
    build: {
        outDir: 'dist',
    }
}))
