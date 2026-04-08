// src/utils/roomBuilder.js
import { isoUtils } from './isometric.js';

export class RoomBuilder {
    constructor(scene, roomConfig) {
        this.scene = scene;
        this.config = roomConfig;
        this.tileWidth = 64;
        this.tileHeight = 32;
        this.container = null;
        this.floorGraphics = null;
        this.wallsGraphics = null;
        this.itemsContainer = null;
    }
    
    build() {
        // Создаем контейнер для комнаты
        this.container = this.scene.add.container(0, 0);
        
        // Рисуем пол
        this.drawFloor();
        
        // Рисуем стены
        this.drawWalls();
        
        // Контейнер для предметов
        this.itemsContainer = this.scene.add.container(0, 0);
        this.container.add(this.itemsContainer);
        
        return this.container;
    }
    
    drawFloor() {
        this.floorGraphics = this.scene.add.graphics();
        
        for (let i = -1; i <= this.config.width; i++) {
            for (let j = -1; j <= this.config.height; j++) {
                const screenPos = isoUtils.isoToScreen(i, j);
                
                // Заливка тайла
                this.floorGraphics.fillStyle(this.config.floorColor, 0.8);
                this.drawTile(this.floorGraphics, screenPos.x, screenPos.y, 0xffffff);
                
                // Обводка
                this.floorGraphics.lineStyle(1, 0x4ecca3, 0.3);
                this.drawTile(this.floorGraphics, screenPos.x, screenPos.y);
            }
        }
        
        this.container.add(this.floorGraphics);
    }
    
    drawWalls() {
        this.wallsGraphics = this.scene.add.graphics();
        this.wallsGraphics.fillStyle(this.config.wallColor, 0.9);
        
        // Рисуем стены по периметру
        for (let x = -1; x <= this.config.width; x++) {
            // Верхняя стена
            this.drawWallAt(x, -1);
            // Нижняя стена
            this.drawWallAt(x, this.config.height);
        }
        
        for (let y = 0; y < this.config.height; y++) {
            // Левая стена
            this.drawWallAt(-1, y);
            // Правая стена
            this.drawWallAt(this.config.width, y);
        }
        
        this.container.add(this.wallsGraphics);
    }
    
    drawWallAt(isoX, isoY) {
        const screenPos = isoUtils.isoToScreen(isoX, isoY);
        
        // Рисуем стену как приподнятый тайл
        this.wallsGraphics.fillStyle(this.config.wallColor, 0.9);
        this.drawTile(this.wallsGraphics, screenPos.x, screenPos.y - 16);
        
        // Добавляем тень
        this.wallsGraphics.fillStyle(0x000000, 0.2);
        this.drawTile(this.wallsGraphics, screenPos.x + 4, screenPos.y - 12);
    }
    
    drawTile(graphics, x, y, color = null) {
        const halfWidth = this.tileWidth / 2;
        const halfHeight = this.tileHeight / 2;
        
        graphics.beginPath();
        graphics.moveTo(x, y - halfHeight);
        graphics.lineTo(x + halfWidth, y);
        graphics.lineTo(x, y + halfHeight);
        graphics.lineTo(x - halfWidth, y);
        graphics.closePath();
        
        if (color) {
            graphics.fillStyle(color, 0.5);
        }
        graphics.fillPath();
        graphics.strokePath();
    }
    
    clear() {
        if (this.container) {
            this.container.destroy();
        }
    }
}