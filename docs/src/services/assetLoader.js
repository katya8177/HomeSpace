// docs/src/services/assetLoader.js
export class AssetLoader {
    constructor(scene) {
        this.scene = scene;
        this.basePath = '/assets/furniture/';
    }
    
    loadBaseTextures() {
        const categories = ['base', 'bathroom', 'bedroom', 'kitchen', 'livingroom', 'decor', 'electronics'];
        
        categories.forEach(category => {
            this.loadCategory(category);
        });
        
        // Загружаем фоны
        const rooms = ['default', 'bedroom', 'kitchen', 'bathroom'];
        rooms.forEach(room => {
            this.scene.load.image(`bg_${room}`, `${this.basePath}backgrounds/${room}.png`);
        });
    }
    
    loadCategory(category) {
        console.log(`📦 Loading category: ${category}`);
        // Здесь можно загружать текстуры для категории
        // В вашем оригинальном коде эта логика уже есть
    }
}