// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: 'docs',
    base: './',
    publicDir: 'assets',
    server: {
        port: 3000,
        open: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true
            }
        }
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'docs/index.html'),
                game: resolve(__dirname, 'docs/game.html'),
                tasks: resolve(__dirname, 'docs/tasks.html'),
                chat: resolve(__dirname, 'docs/chat.html'),
                wishes: resolve(__dirname, 'docs/wishes.html'),
                settings: resolve(__dirname, 'docs/settings.html')
            }
        }
    }
});