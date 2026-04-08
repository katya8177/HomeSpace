// src/scenes/TestScene.js
export class TestScene extends Phaser.Scene {
    constructor() {
        super('TestScene');
    }
    
    preload() {
        // Пробуем загрузить одно изображение напрямую
        this.load.image('test', 'assets/furniture/base/wall/wall_NE.png');
    }
    
    create() {
        this.add.text(100, 100, 'Тест загрузки', { fill: '#fff' });
        
        if (this.textures.exists('test')) {
            this.add.text(100, 150, '✅ Изображение загружено!', { fill: '#0f0' });
            this.add.image(400, 300, 'test');
        } else {
            this.add.text(100, 150, '❌ Изображение НЕ загружено!', { fill: '#f00' });
        }
    }
}
