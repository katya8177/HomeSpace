// Тестовый скрипт для проверки новой категории "rooms"
import { furnitureData, getItemsByCategory } from './docs/src/config/furniture.js';

console.log('🧪 Тестирование новой категории "rooms"');

// Проверяем, что категория существует
const roomsItems = getItemsByCategory('rooms');
console.log(`Найдено предметов в категории "rooms": ${roomsItems.length}`);

roomsItems.forEach(item => {
    console.log(`- ${item.name} (${item.key}): ${item.category}, размеры: ${item.size}`);
});

// Проверяем структуру данных
console.log('\n📋 Структура данных для roomKitchen:');
console.log(furnitureData.roomKitchen);

console.log('\n✅ Тест завершен!');