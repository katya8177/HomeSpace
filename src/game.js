// src/game.js
import Phaser from 'phaser';
import { RegistrationScene } from './scenes/RegistrationScene.js';
import { LoadingScene } from './scenes/LoadingScene.js';
import { EditorScene } from './scenes/EditorScene.js';
import { WebViewScene } from './scenes/WebViewScene.js';

const config = {
    type: Phaser.WEBGL,
    width: 1280,
    height: 800,
    parent: 'game',
    scene: [
        RegistrationScene,
        LoadingScene,
        EditorScene,
        WebViewScene
    ],
    backgroundColor: '#1a1a2e',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    dom: {
        createContainer: true
    }
};

new Phaser.Game(config);