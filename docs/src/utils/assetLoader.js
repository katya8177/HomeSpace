// src/utils/assetLoader.js
import { furnitureData } from '../config/furniture.js';

/**
 * Загружает все текстуры мебели на основе furnitureData
 * @param {Phaser.Scene} scene - сцена, в которой происходит загрузка
 * @returns {number} общее количество загружаемых файлов
 */
export function loadAllFurniture(scene) {
    console.log('%c🪑 Загрузка мебели...', 'color: #4ecca3; font-size: 14px; font-weight: bold');
    
    let totalFiles = 0;
    let successCount = 0;
    let errorCount = 0;
    
    // Слушаем события загрузки
    scene.load.on('filecomplete', (key) => {
        successCount++;
        console.log(`✅ Загружено: ${key} (${successCount}/${totalFiles})`);
    });
    
    scene.load.on('loaderror', (file) => {
        errorCount++;
        console.error(`❌ Ошибка загрузки: ${file.key} - ${file.url}`);
    });
    
    // Проходим по всем предметам в furnitureData
    Object.entries(furnitureData).forEach(([itemKey, itemData]) => {
        // Получаем список ротаций для этого предмета
        const rotations = itemData.rotations || ['NE', 'NW', 'SE', 'SW'];
        
        // Для каждой ротации создаем путь и загружаем текстуру
        rotations.forEach(rotation => {
            // Формируем правильный путь к файлу
            // Структура: assets/furniture/{category}/{folder}/{itemKey}_{rotation}.png
            // Например: assets/furniture/base/wall/wall_NE.png
            const filePath = `assets/furniture/${itemData.category}/${itemData.folder}/${itemKey}_${rotation}.png`;
            
            // Создаем ключ текстуры: itemKey_rotation
            const textureKey = `${itemKey}_${rotation}`;
            
            console.log(`🔍 Загрузка: ${textureKey} -> ${filePath}`);
            scene.load.image(textureKey, filePath);
            totalFiles++;
        });
    });
    
    console.log(`📊 Всего файлов для загрузки: ${totalFiles}`);
    return totalFiles;
}

/**
 * Загружает текстуры для конкретной категории (для динамической загрузки)
 * @param {Phaser.Scene} scene - сцена
 * @param {string} category - категория предметов
 * @returns {Promise<number>} количество загруженных текстур
 */
export function loadCategoryFurniture(scene, category) {
    return new Promise((resolve) => {
        let loadedCount = 0;
        let totalToLoad = 0;
        
        console.log(`📦 Загрузка категории: ${category}`);
        
        // Находим все предметы в указанной категории
        const items = Object.entries(furnitureData).filter(
            ([_, data]) => data.category === category
        );
        
        items.forEach(([itemKey, itemData]) => {
            const rotations = itemData.rotations || ['NE', 'NW', 'SE', 'SW'];
            
            rotations.forEach(rotation => {
                totalToLoad++;
                const filePath = `assets/furniture/${itemData.category}/${itemData.folder}/${itemKey}_${rotation}.png`;
                const textureKey = `${itemKey}_${rotation}`;
                
                // Проверяем, не загружена ли уже текстура
                if (!scene.textures.exists(textureKey)) {
                    scene.load.image(textureKey, filePath);
                } else {
                    loadedCount++;
                }
            });
        });
        
        // Если ничего не нужно загружать, сразу возвращаем
        if (totalToLoad === loadedCount) {
            console.log(`✅ Все текстуры категории ${category} уже загружены`);
            resolve(loadedCount);
            return;
        }
        
        // Ждем завершения загрузки
        const onComplete = () => {
            scene.load.off('complete', onComplete);
            console.log(`✅ Загружено ${totalToLoad} текстур для категории ${category}`);
            resolve(totalToLoad);
        };
        
        scene.load.once('complete', onComplete);
        scene.load.start();
    });
}

/**
 * Загружает одну текстуру по ключу предмета и ротации
 * @param {Phaser.Scene} scene - сцена
 * @param {string} itemKey - ключ предмета
 * @param {string} rotation - ротация (NE, NW, SE, SW)
 * @returns {Promise<boolean>} успешность загрузки
 */
export function loadSingleTexture(scene, itemKey, rotation) {
    return new Promise((resolve, reject) => {
        const itemData = furnitureData[itemKey];
        
        if (!itemData) {
            console.error(`❌ Предмет ${itemKey} не найден в furnitureData`);
            reject(new Error(`Предмет ${itemKey} не найден`));
            return;
        }
        
        const filePath = `assets/furniture/${itemData.category}/${itemData.folder}/${itemKey}_${rotation}.png`;
        const textureKey = `${itemKey}_${rotation}`;
        
        // Если текстура уже загружена
        if (scene.textures.exists(textureKey)) {
            console.log(`✅ Текстура уже загружена: ${textureKey}`);
            resolve(true);
            return;
        }
        
        console.log(`🔍 Загрузка одной текстуры: ${textureKey} -> ${filePath}`);
        
        // Загружаем текстуру
        scene.load.image(textureKey, filePath);
        
        scene.load.once('complete', () => {
            console.log(`✅ Загружена: ${textureKey}`);
            resolve(true);
        });
        
        scene.load.once('loaderror', (file) => {
            console.error(`❌ Ошибка загрузки ${textureKey}:`, file);
            reject(new Error(`Не удалось загрузить ${textureKey}`));
        });
        
        scene.load.start();
    });
}

/**
 * Загружает текстуры для комнат (стены, пол, двери, окна)
 * @param {Phaser.Scene} scene - сцена
 */
export function loadRoomTextures(scene) {
    console.log('🏠 Загрузка текстур комнат...');
    
    const roomTextures = [
        { key: 'wall_brick', path: 'assets/rooms/wall_brick.png' },
        { key: 'wall_wood', path: 'assets/rooms/wall_wood.png' },
        { key: 'floor_wood', path: 'assets/rooms/floor_wood.png' },
        { key: 'floor_tile', path: 'assets/rooms/floor_tile.png' },
        { key: 'floor_carpet', path: 'assets/rooms/floor_carpet.png' },
        { key: 'door', path: 'assets/rooms/door.png' },
        { key: 'window', path: 'assets/rooms/window.png' }
    ];
    
    let loadedCount = 0;
    
    roomTextures.forEach(tex => {
        if (!scene.textures.exists(tex.key)) {
            scene.load.image(tex.key, tex.path);
            loadedCount++;
        }
    });
    
    if (loadedCount > 0) {
        console.log(`📦 Загрузка ${loadedCount} текстур комнат`);
        scene.load.start();
    } else {
        console.log('✅ Все текстуры комнат уже загружены');
    }
}

/**
 * Проверяет наличие текстур (для отладки)
 */
export function checkPaths() {
    console.log('%c🔍 ПРОВЕРКА ПУТЕЙ К ТЕКСТУРАМ', 'color: #ffd700; font-size: 14px; font-weight: bold');
    
    let totalItems = 0;
    let totalTextures = 0;
    const missingTextures = [];
    
    Object.entries(furnitureData).forEach(([itemKey, itemData]) => {
        const rotations = itemData.rotations || ['NE', 'NW', 'SE', 'SW'];
        totalItems++;
        
        rotations.forEach(rotation => {
            totalTextures++;
            const expectedPath = `assets/furniture/${itemData.category}/${itemData.folder}/${itemKey}_${rotation}.png`;
            console.log(`  📁 ${expectedPath}`);
        });
    });
    
    console.log(`📊 Итого: ${totalItems} предметов, ${totalTextures} текстур`);
    
    if (missingTextures.length > 0) {
        console.warn('⚠️ Отсутствующие текстуры:', missingTextures);
    }
    
    return missingTextures;
}

/**
 * Предварительная загрузка текстур для часто используемых предметов
 * @param {Phaser.Scene} scene - сцена
 */
export function preloadCommonFurniture(scene) {
    // Список наиболее часто используемых предметов
    const commonItems = [
        'wall', 'floorFull', 'doorway', 
        'bedSingle', 'bedDouble', 
        'chair', 'table',
        'loungeSofa', 'loungeChair',
        'kitchenStove', 'kitchenFridge',
        'toilet', 'bathtub'
    ];
    
    let loadedCount = 0;
    let totalItems = 0;
    
    console.log('📦 Предзагрузка часто используемой мебели...');
    
    commonItems.forEach(itemKey => {
        const itemData = furnitureData[itemKey];
        if (itemData) {
            const rotations = itemData.rotations || ['NE', 'NW', 'SE', 'SW'];
            totalItems += rotations.length;
            
            rotations.forEach(rotation => {
                const textureKey = `${itemKey}_${rotation}`;
                if (!scene.textures.exists(textureKey)) {
                    const filePath = `assets/furniture/${itemData.category}/${itemData.folder}/${itemKey}_${rotation}.png`;
                    scene.load.image(textureKey, filePath);
                    loadedCount++;
                }
            });
        }
    });
    
    if (loadedCount > 0) {
        console.log(`📦 Предзагрузка ${loadedCount} часто используемых текстур`);
        scene.load.start();
    } else {
        console.log('✅ Все часто используемые текстуры уже загружены');
    }
}

/**
 * Тестовая функция для проверки загрузки в консоли браузера
 */
export function testInBrowser() {
    console.log('%c🧪 ТЕСТ ЗАГРУЗКИ ТЕКСТУР В БРАУЗЕРЕ', 'color: #e94560; font-size: 16px; font-weight: bold');
    
    const testItems = [
        { key: 'wall', rotation: 'NE', category: 'base', folder: 'wall' },
        { key: 'toilet', rotation: 'NE', category: 'bathroom', folder: 'toilet' },
        { key: 'bedDouble', rotation: 'NE', category: 'bedroom', folder: 'bedDouble' },
        { key: 'kitchenStove', rotation: 'NE', category: 'kitchen', folder: 'kitchenStove' },
        { key: 'loungeSofa', rotation: 'NE', category: 'livingroom', folder: 'loungeSofa' }
    ];
    
    testItems.forEach(item => {
        const testPath = `assets/furniture/${item.category}/${item.folder}/${item.key}_${item.rotation}.png`;
        console.log(`\n🔍 Проверка: ${testPath}`);
        
        fetch(testPath)
            .then(response => {
                if (response.ok) {
                    console.log(`  ✅ УСПЕХ (${response.status})`);
                    return response.blob();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            })
            .then(blob => {
                console.log(`  📦 Размер: ${(blob.size / 1024).toFixed(2)} KB`);
                console.log(`  🖼️ Тип: ${blob.type}`);
            })
            .catch(error => {
                console.error(`  ❌ ОШИБКА: ${error.message}`);
                
                // Пробуем альтернативный путь
                const altPath = `src/config/home/${item.category}/${item.folder}/${item.key}_${item.rotation}.png`;
                console.log(`  🔄 Пробуем альтернативный путь: ${altPath}`);
                
                fetch(altPath)
                    .then(r => {
                        if (r.ok) {
                            console.log(`  ✅ Альтернативный путь работает!`);
                        } else {
                            console.log(`  ❌ Альтернативный путь тоже не работает`);
                        }
                    })
                    .catch(e => console.log(`  ❌ Ошибка альтернативного пути: ${e.message}`));
            });
    });
}

/**
 * Загружает все текстуры комнат
 * @param {Phaser.Scene} scene 
 */
export function loadAllRoomTextures(scene) {
    const roomTextures = [
        { key: 'floor_wood', path: 'assets/rooms/floor_wood.png' },
        { key: 'floor_tile', path: 'assets/rooms/floor_tile.png' },
        { key: 'wall_brick', path: 'assets/rooms/wall_brick.png' },
        { key: 'wall_wood', path: 'assets/rooms/wall_wood.png' },
        { key: 'door', path: 'assets/rooms/door.png' },
        { key: 'window', path: 'assets/rooms/window.png' }
    ];
    
    let loadedCount = 0;
    
    roomTextures.forEach(tex => {
        if (!scene.textures.exists(tex.key)) {
            scene.load.image(tex.key, tex.path);
            loadedCount++;
        }
    });
    
    if (loadedCount > 0) {
        console.log(`🏠 Загрузка ${loadedCount} текстур комнат`);
        scene.load.start();
    }
}