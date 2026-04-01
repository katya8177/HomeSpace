// src/scenes/LoadingScene.js
import { loadAllFurniture } from '../utils/assetLoader.js';
import { UIDesign } from '../utils/UIDesign.js';

export class LoadingScene extends Phaser.Scene {
    constructor() {
        super('LoadingScene');
        this.ui = null;
    }
    
    create() {
        const { width, height } = this.cameras.main;
        
        // Initialize UI
        this.ui = new UIDesign(this);
        
        // Background with gradient
        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
        graphics.fillRect(0, 0, width, height);
        
        // Floating logo
        const logo = this.add.text(width/2, height/2 - 100, '🏠', {
            fontSize: '120px'
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: logo,
            y: height/2 - 120,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Title with gradient
        const title = this.add.text(width/2, height/2, 'HomeSpace', {
            fontSize: '64px',
            fontStyle: 'bold',
            fontFamily: 'Inter, Arial, sans-serif',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Progress bar
        const progressBar = this.ui.createProgressBar(width/2, height/2 + 80, 400, 20, 0, 100);
        
        // Loading tips
        const tips = [
            'Нажимай ПКМ на мебель чтобы повернуть',
            'Родители могут создавать задачи с бонусами',
            'Выполняй задачи и получай бонусы',
            'Копи бонусы и покупай желания',
            'Вся семья может общаться в чате'
        ];
        
        const tipText = this.add.text(width/2, height/2 + 130, tips[0], {
            fontSize: '16px',
            fill: '#aaaaaa',
            fontFamily: 'Inter, Arial, sans-serif'
        }).setOrigin(0.5);
        
        // Rotate tips
        let tipIndex = 0;
        this.time.addEvent({
            delay: 3000,
            callback: () => {
                tipIndex = (tipIndex + 1) % tips.length;
                tipText.setText(tips[tipIndex]);
                
                this.tweens.add({
                    targets: tipText,
                    alpha: 0,
                    duration: 200,
                    yoyo: true,
                    onYoyo: () => tipText.setText(tips[tipIndex])
                });
            },
            loop: true
        });
        
        // Load assets
        const totalFiles = loadAllFurniture(this);
        
        this.load.on('progress', (value) => {
            progressBar.update(value * 100);
        });
        
        this.load.on('complete', () => {
            this.time.delayedCall(1000, () => {
                this.scene.start('MenuScene');
            });
        });
        
        // Start loading
        this.load.start();
    }
}