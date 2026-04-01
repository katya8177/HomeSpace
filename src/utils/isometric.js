// src/utils/isometric.js
// Утилиты для изометрических преобразований

export class IsometricUtils {
    constructor(tileWidth = 64, tileHeight = 32) {
        this.tileWidth = tileWidth;
        this.tileHeight = tileHeight;
    }
    
    // Преобразование изометрических координат в экранные
    isoToScreen(x, y, z = 0) {
        const screenX = (x - y) * this.tileWidth / 2;
        const screenY = (x + y) * this.tileHeight / 2 - z * this.tileHeight / 2;
        return { x: screenX, y: screenY };
    }
    
    // Преобразование экранных координат в изометрические
    screenToIso(screenX, screenY, z = 0) {
        const x = (screenX / (this.tileWidth / 2) + screenY / (this.tileHeight / 2)) / 2;
        const y = (screenY / (this.tileHeight / 2) - screenX / (this.tileWidth / 2)) / 2;
        return { x: Math.round(x), y: Math.round(y) };
    }
    
    // Привязка к сетке
    snapToGrid(isoX, isoY) {
        return {
            x: Math.floor(isoX),
            y: Math.floor(isoY)
        };
    }
    
    // Проверка попадания в изометрический тайл
    pointInTile(screenX, screenY, tileScreenX, tileScreenY) {
        const localX = screenX - tileScreenX;
        const localY = screenY - tileScreenY;
        const halfWidth = this.tileWidth / 2;
        const halfHeight = this.tileHeight / 2;
        
        const dx = Math.abs(localX);
        const dy = Math.abs(localY);
        
        return (dx / halfWidth + dy / halfHeight) <= 1;
    }
}

export const isoUtils = new IsometricUtils(64, 32);