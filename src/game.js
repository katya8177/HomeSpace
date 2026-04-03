// src/game.js
import Phaser from 'phaser';
import { EditorScene } from './scenes/EditorScene.js';

console.log('Starting HomeSpace editor bootstrap');

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 800,
    parent: 'game',
    scene: [EditorScene],
    backgroundColor: '#1a1a2e',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    dom: {
        createContainer: true
    }
};

try {
    const game = new Phaser.Game(config);
    console.log('Phaser editor instance created');

    // Экспортируем сцену в глобальную область для отладки
    window.homespaceGame = game;
    window.getEditorScene = () => game?.scene?.getScene('EditorScene');

    // Проверяем, что сцена действительно загрузилась
    setTimeout(() => {
        const s = window.getEditorScene?.();
        if (s) {
            console.log('EditorScene is ready', s);
            const debugText = s.add.text(20, 46, 'Scene check: OK', { fontSize: '16px', fill: '#00ff00' }).setDepth(9999);
            setTimeout(() => debugText.destroy(), 5000);
        } else {
            console.warn('EditorScene is not available yet');
        }
    }, 1500);
} catch (error) {
    console.error('Failed to initialize editor', error);
    const errorNode = document.getElementById('editor-error');
    if (errorNode) errorNode.style.display = 'flex';
}