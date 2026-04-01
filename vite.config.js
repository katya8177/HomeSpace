// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: 'public',
    base: './',
    publicDir: 'assets',
    server: {
        port: 3000,
        open: true
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'public/index.html'),
                game: resolve(__dirname, 'public/game.html'),
                tasks: resolve(__dirname, 'public/tasks.html'),
                chat: resolve(__dirname, 'public/chat.html'),
                wishes: resolve(__dirname, 'public/wishes.html'),
                settings: resolve(__dirname, 'public/settings.html')
            }
        }
    }
});