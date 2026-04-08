// src/config/rooms.js
// Конфигурация комнат для изометрического вида

export const roomPresets = {
    livingroom: {
        name: 'Гостиная',
        icon: '🛋️',
        backgroundColor: 0x3a5a3a,
        wallColor: 0x8B5A2B,
        width: 12,
        height: 10,
        walls: [
            { x: 0, y: 0, width: 12, height: 1 },      // верхняя стена
            { x: 0, y: 9, width: 12, height: 1 },      // нижняя стена
            { x: 0, y: 0, width: 1, height: 10 },      // левая стена
            { x: 11, y: 0, width: 1, height: 10 }      // правая стена
        ]
    },
    kitchen: {
        name: 'Кухня',
        icon: '🍳',
        backgroundColor: 0x4a6a4a,
        wallColor: 0x9B6A3B,
        width: 10,
        height: 8,
        walls: [
            { x: 0, y: 0, width: 10, height: 1 },
            { x: 0, y: 7, width: 10, height: 1 },
            { x: 0, y: 0, width: 1, height: 8 },
            { x: 9, y: 0, width: 1, height: 8 }
        ]
    },
    bedroom: {
        name: 'Спальня',
        icon: '🛌',
        backgroundColor: 0x5a7a6a,
        wallColor: 0xAD8A5A,
        width: 12,
        height: 10,
        walls: [
            { x: 0, y: 0, width: 12, height: 1 },
            { x: 0, y: 9, width: 12, height: 1 },
            { x: 0, y: 0, width: 1, height: 10 },
            { x: 11, y: 0, width: 1, height: 10 }
        ]
    },
    bathroom: {
        name: 'Ванная',
        icon: '🚿',
        backgroundColor: 0x6a8a9a,
        wallColor: 0xCDAA7A,
        width: 8,
        height: 8,
        walls: [
            { x: 0, y: 0, width: 8, height: 1 },
            { x: 0, y: 7, width: 8, height: 1 },
            { x: 0, y: 0, width: 1, height: 8 },
            { x: 7, y: 0, width: 1, height: 8 }
        ]
    }
};

export const getRoomPreset = (roomKey) => {
    return roomPresets[roomKey] || roomPresets.livingroom;
};