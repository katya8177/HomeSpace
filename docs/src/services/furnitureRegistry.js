// docs/src/services/furnitureRegistry.js
export class FurnitureRegistry {
    constructor() {
        this.furniture = this.initCatalog();
    }
    
    initCatalog() {
        return [
            // Base
            { id: 'wall', name: 'Стена', category: 'base', icon: '🧱', hasDirections: true },
            { id: 'floorFull', name: 'Пол', category: 'base', icon: '⬜', hasDirections: false },
            
            // Bathroom
            { id: 'toilet', name: 'Унитаз', category: 'bathroom', icon: '🚽', hasDirections: true },
            { id: 'shower', name: 'Душ', category: 'bathroom', icon: '🚿', hasDirections: true },
            { id: 'bathtub', name: 'Ванна', category: 'bathroom', icon: '🛁', hasDirections: true },
            { id: 'washer', name: 'Стиралка', category: 'bathroom', icon: '🧺', hasDirections: true },
            
            // Bedroom
            { id: 'bedDouble', name: 'Двуспальная кровать', category: 'bedroom', icon: '🛏', hasDirections: true },
            { id: 'bedSingle', name: 'Односпальная кровать', category: 'bedroom', icon: '🛌', hasDirections: true },
            { id: 'cabinetBed', name: 'Тумбочка', category: 'bedroom', icon: '🗄', hasDirections: true },
            
            // Kitchen
            { id: 'kitchenStove', name: 'Плита', category: 'kitchen', icon: '🍳', hasDirections: true },
            { id: 'kitchenFridge', name: 'Холодильник', category: 'kitchen', icon: '🧊', hasDirections: true },
            { id: 'kitchenSink', name: 'Мойка', category: 'kitchen', icon: '🚰', hasDirections: true },
            { id: 'table', name: 'Стол', category: 'kitchen', icon: '🍽', hasDirections: false },
            { id: 'chair', name: 'Стул', category: 'kitchen', icon: '🪑', hasDirections: true },
            
            // Livingroom
            { id: 'loungeSofa', name: 'Диван', category: 'livingroom', icon: '🛋', hasDirections: true },
            { id: 'loungeChair', name: 'Кресло', category: 'livingroom', icon: '💺', hasDirections: true },
            { id: 'tableCoffee', name: 'Журнальный столик', category: 'livingroom', icon: '☕', hasDirections: false },
            { id: 'bookcaseOpen', name: 'Книжный шкаф', category: 'livingroom', icon: '📚', hasDirections: true },
            
            // Decor
            { id: 'pottedPlant', name: 'Растение', category: 'decor', icon: '🌵', hasDirections: false },
            { id: 'lampRoundTable', name: 'Лампа', category: 'decor', icon: '💡', hasDirections: false },
            { id: 'rugRound', name: 'Ковёр', category: 'decor', icon: '🔴', hasDirections: false },
            
            // Electronics
            { id: 'televisionModern', name: 'Телевизор', category: 'electronics', icon: '📺', hasDirections: true },
            { id: 'computerScreen', name: 'Компьютер', category: 'electronics', icon: '💻', hasDirections: true },
            { id: 'speaker', name: 'Колонка', category: 'electronics', icon: '🔊', hasDirections: true }
        ];
    }
    
    get(id) {
        return this.furniture.find(f => f.id === id);
    }
    
    getAll() {
        return this.furniture;
    }
    
    getByCategory(category) {
        return this.furniture.filter(f => f.category === category);
    }
}