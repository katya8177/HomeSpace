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
    new Phaser.Game(config);
    console.log('Phaser editor instance created');
} catch (error) {
    console.error('Failed to initialize editor', error);
    const errorNode = document.getElementById('editor-error');
    if (errorNode) errorNode.style.display = 'flex';
}