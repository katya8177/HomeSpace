import { loadAllFurniture, preloadCommonFurniture } from '../utils/assetLoader.js';

export class LoadingScene extends Phaser.Scene {
    constructor() {
        super('LoadingScene');
    }
    
    create() {
        const { width, height } = this.cameras.main;
        
        // Градиентный фон
        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x7faee1, 0x7faee1, 0x6fa3de, 0x6fa3de, 1);
        graphics.fillRect(0, 0, width, height);
        
        // Парящий логотип
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
        
        // Заголовок
        const title = this.add.text(width/2, height/2, 'HomeSpace', {
            fontSize: '64px',
            fontStyle: 'bold',
            fontFamily: 'Inter, Arial, sans-serif',
            color: '#ffffff',
            stroke: '#0850ed',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Прогресс-бар
        const progressBg = this.add.rectangle(width/2, height/2 + 80, 400, 20, 0x232931)
            .setOrigin(0.5);
        
        const progressBar = this.add.rectangle(
            width/2 - 200, 
            height/2 + 80, 
            0, 
            16, 
            0x4ecca3
        ).setOrigin(0, 0.5);
        
        // Текст прогресса
        const progressText = this.add.text(width/2, height/2 + 110, '0%', {
            fontSize: '18px',
            fill: '#0850ed',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Статус загрузки
        const statusText = this.add.text(width/2, height/2 + 140, 'Подготовка...', {
            fontSize: '16px',
            fill: '#aaaaaa'
        }).setOrigin(0.5);
        
        // Подсказки
        const tips = [
            'Нажимайте правую кнопку мыши на мебель чтобы повернуть',
            'Родители могут создавать задания с бонусами',
            'Выполняйте задания и получайте бонусы',
            'Копите бонусы и покупайте желания',
            'Вся семья может общаться в чате',
            'Задания можно закреплять за конкретными предметами',
            'Желания нужно одобрять родителям'
        ];
        
        const tipText = this.add.text(width/2, height/2 + 180, tips[0], {
            fontSize: '16px',
            fill: '#888888',
            fontFamily: 'Inter, Arial, sans-serif'
        }).setOrigin(0.5);
        
        // Смена подсказок
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
        
        // Загружаем всю мебель на основе furnitureData
        const totalFiles = loadAllFurniture(this);
        statusText.setText(`Загрузка ${totalFiles} текстур...`);
        
        // Обновление прогресса
        this.load.on('progress', (value) => {
            const percent = Math.floor(value * 100);
            progressBar.width = 396 * value;
            progressText.setText(`${percent}%`);
            statusText.setText(`Загрузка текстур: ${percent}%`);
        });
        
        // Ошибки загрузки
        this.load.on('loaderror', (file) => {
            console.error('❌ Ошибка загрузки:', file.key, file.src);
            statusText.setText(`Ошибка: ${file.key}`);
            statusText.setColor('#e94560');
        });
        
        // Завершение загрузки
        this.load.on('complete', () => {
            console.log('✅ Все текстуры загружены!');
            statusText.setText('Загрузка завершена!');
            statusText.setColor('#4ecca3');
            
            // Предзагрузка часто используемых предметов (опционально)
            // preloadCommonFurniture(this);
            
            this.time.delayedCall(1000, () => {
                this.scene.start('MenuScene');
            });
        });
        
        // Начинаем загрузку
        this.load.start();
    }
}