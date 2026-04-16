// src/config/furniture.js
// ПОЛНЫЙ КОНФИГ ВСЕЙ МЕБЕЛИ

export const furnitureData = {
    // ============ БАЗОВЫЕ ЭЛЕМЕНТЫ (base) ============
    doorway: {
        name: 'Дверной проем',
        category: 'base',
        folder: 'doorway',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    doorwayFront: {
        name: 'Дверной проем с фасадом',
        category: 'base',
        folder: 'doorwayFront',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    doorwayOpen: {
        name: 'Открытый дверной проем',
        category: 'base',
        folder: 'doorwayOpen',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    floorCorner: {
        name: 'Угол пола',
        category: 'base',
        folder: 'floorCorner',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    floorCornerRound: {
        name: 'Закругленный угол пола',
        category: 'base',
        folder: 'floorCornerRound',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    floorFull: {
        name: 'Полная плитка пола',
        category: 'base',
        folder: 'floorFull',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    floorHalf: {
        name: 'Половина плитки пола',
        category: 'base',
        folder: 'floorHalf',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    paneling: {
        name: 'Панели',
        category: 'base',
        folder: 'paneling',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    stairs: {
        name: 'Лестница',
        category: 'base',
        folder: 'stairs',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 2]
    },
    stairsCorner: {
        name: 'Угловая лестница',
        category: 'base',
        folder: 'stairsCorner',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    stairsOpen: {
        name: 'Открытая лестница',
        category: 'base',
        folder: 'stairsOpen',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 2]
    },
    stairsOpenSingle: {
        name: 'Одинарная открытая лестница',
        category: 'base',
        folder: 'stairsOpenSingle',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    wall: {
        name: 'Стена',
        category: 'base',
        folder: 'wall',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    wallCorner: {
        name: 'Угол стены',
        category: 'base',
        folder: 'wallCorner',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    wallCornerRond: {
        name: 'Закругленный угол стены',
        category: 'base',
        folder: 'wallCornerRond',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    wallDoorway: {
        name: 'Стена с дверным проемом',
        category: 'base',
        folder: 'wallDoorway',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    wallDoorwayWide: {
        name: 'Широкая стена с дверным проемом',
        category: 'base',
        folder: 'wallDoorwayWide',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 2]
    },
    wallHalf: {
        name: 'Половина стены',
        category: 'base',
        folder: 'wallHalf',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    wallWindow: {
        name: 'Стена с окном',
        category: 'base',
        folder: 'wallWindow',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    wallWindowSlide: {
        name: 'Стена с раздвижным окном',
        category: 'base',
        folder: 'wallWindowSlide',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },

    // ============ ВАННАЯ (bathroom) ============
    bathroomCabinetDrawer: {
        name: 'Шкафчик с ящиками',
        category: 'bathroom',
        folder: 'bathroomCabinetDrawer',
        rotations: ['NW', 'SE', 'SW'],
        size: [1, 1]
    },
    bathroomMirror: {
        name: 'Зеркало',
        category: 'bathroom',
        folder: 'bathroomMirror',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    bathroomSink: {
        name: 'Раковина',
        category: 'bathroom',
        folder: 'bathroomSink',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    bathroomSinkSquare: {
        name: 'Квадратная раковина',
        category: 'bathroom',
        folder: 'bathroomSinkSquare',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    bathtub: {
        name: 'Ванна',
        category: 'bathroom',
        folder: 'bathtub',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    dryer: {
        name: 'Сушилка',
        category: 'bathroom',
        folder: 'dryer',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    shower: {
        name: 'Душ',
        category: 'bathroom',
        folder: 'shower',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    showerRound: {
        name: 'Круглый душ',
        category: 'bathroom',
        folder: 'showerRound',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    toilet: {
        name: 'Унитаз',
        category: 'bathroom',
        folder: 'toilet',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    toiletSquare: {
        name: 'Квадратный унитаз',
        category: 'bathroom',
        folder: 'toiletSquare',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    washer: {
        name: 'Стиральная машина',
        category: 'bathroom',
        folder: 'washer',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    washerDryerStacked: {
        name: 'Стиралка + сушилка',
        category: 'bathroom',
        folder: 'washerDryerStacked',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },

    // ============ СПАЛЬНЯ (bedroom) ============
    bedBunk: {
        name: 'Двухъярусная кровать',
        category: 'bedroom',
        folder: 'bedBunk',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    bedDouble: {
        name: 'Двуспальная кровать',
        category: 'bedroom',
        folder: 'bedDouble',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 2]
    },
    bedSingle: {
        name: 'Односпальная кровать',
        category: 'bedroom',
        folder: 'bedSingle',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    cabinetBed: {
        name: 'Прикроватная тумба',
        category: 'bedroom',
        folder: 'cabinetBed',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    cabinetBedDrawer: {
        name: 'Тумба с ящиком',
        category: 'bedroom',
        folder: 'cabinetBedDrawer',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    cabinetBedDrawerTable: {
        name: 'Тумба-столик',
        category: 'bedroom',
        folder: 'cabinetBedDrawerTable',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },

    // ============ ДЕКОР (decor) ============
    bear: {
        name: 'Плюшевый мишка',
        category: 'decor',
        folder: 'bear',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    books: {
        name: 'Книги',
        category: 'decor',
        folder: 'books',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    cardboardBoxClosed: {
        name: 'Закрытая коробка',
        category: 'decor',
        folder: 'cardboardBoxClosed',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    cardboardBoxOpen: {
        name: 'Открытая коробка',
        category: 'decor',
        folder: 'cardboardBoxOpen',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    ceilingFan: {
        name: 'Потолочный вентилятор',
        category: 'decor',
        folder: 'ceilingFan',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    coatRack: {
        name: 'Вешалка',
        category: 'decor',
        folder: 'coatRack',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    coatRackStanding: {
        name: 'Напольная вешалка',
        category: 'decor',
        folder: 'coatRackStanding',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    pillow: {
        name: 'Подушка',
        category: 'decor',
        folder: 'pillow',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    pillowBlue: {
        name: 'Синяя подушка',
        category: 'decor',
        folder: 'pillowBlue',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    pillowBlueLong: {
        name: 'Длинная синяя подушка',
        category: 'decor',
        folder: 'pillowBlueLong',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    pillowLong: {
        name: 'Длинная подушка',
        category: 'decor',
        folder: 'pillowLong',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    plantSmall1: {
        name: 'Маленькое растение 1',
        category: 'decor',
        folder: 'plantSmall1',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    plantSmall2: {
        name: 'Маленькое растение 2',
        category: 'decor',
        folder: 'plantSmall2',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    plantSmall3: {
        name: 'Маленькое растение 3',
        category: 'decor',
        folder: 'plantSmall3',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    pottedPlant: {
        name: 'Растение в горшке',
        category: 'decor',
        folder: 'pottedPlant',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    rugDoormat: {
        name: 'Прикроватный коврик',
        category: 'decor',
        folder: 'rugDoormat',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    rugRectangle: {
        name: 'Прямоугольный ковер',
        category: 'decor',
        folder: 'rugRectangle',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    rugRound: {
        name: 'Круглый ковер',
        category: 'decor',
        folder: 'rugRound',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    rugRounded: {
        name: 'Ковер с закруглениями',
        category: 'decor',
        folder: 'rugRounded',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    rugSquare: {
        name: 'Квадратный ковер',
        category: 'decor',
        folder: 'rugSquare',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },

    // ============ ЭЛЕКТРОНИКА (electronics) ============
    computerKeyboard: {
        name: 'Клавиатура',
        category: 'electronics',
        folder: 'computerKeyboard',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    computerMouse: {
        name: 'Мышь',
        category: 'electronics',
        folder: 'computerMouse',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    computerScreen: {
        name: 'Монитор',
        category: 'electronics',
        folder: 'computerScreen',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    lampRoundFloor: {
        name: 'Круглый торшер',
        category: 'electronics',
        folder: 'lampRoundFloor',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    lampRoundTable: {
        name: 'Круглая настольная лампа',
        category: 'electronics',
        folder: 'lampRoundTable',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    lampSquareCeiling: {
        name: 'Квадратный потолочный светильник',
        category: 'electronics',
        folder: 'lampSquareCeiling',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    lampSquareFloor: {
        name: 'Квадратный торшер',
        category: 'electronics',
        folder: 'lampSquareFloor',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    lampSquareTable: {
        name: 'Квадратная настольная лампа',
        category: 'electronics',
        folder: 'lampSquareTable',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    lampWall: {
        name: 'Бра',
        category: 'electronics',
        folder: 'lampWall',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    laptop: {
        name: 'Ноутбук',
        category: 'electronics',
        folder: 'laptop',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    radio: {
        name: 'Радио',
        category: 'electronics',
        folder: 'radio',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    speaker: {
        name: 'Колонка',
        category: 'electronics',
        folder: 'speaker',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    speakerSmall: {
        name: 'Маленькая колонка',
        category: 'electronics',
        folder: 'speakerSmall',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    televisionAntenna: {
        name: 'Телевизор с антенной',
        category: 'electronics',
        folder: 'televisionAntenna',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    televisionModern: {
        name: 'Современный телевизор',
        category: 'electronics',
        folder: 'televisionModern',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    televisionVintage: {
        name: 'Винтажный телевизор',
        category: 'electronics',
        folder: 'televisionVintage',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },

    // ============ КУХНЯ (kitchen) ============
    chair: {
        name: 'Стул',
        category: 'kitchen',
        folder: 'chair',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    chairCushion: {
        name: 'Стул с подушкой',
        category: 'kitchen',
        folder: 'chairCushion',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    chairRounded: {
        name: 'Стул с круглой спинкой',
        category: 'kitchen',
        folder: 'chairRounded',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    hoodLarge: {
        name: 'Большая вытяжка',
        category: 'kitchen',
        folder: 'hoodLarge',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    hoodModern: {
        name: 'Современная вытяжка',
        category: 'kitchen',
        folder: 'hoodLarge_2',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenBar: {
        name: 'Барная стойка',
        category: 'kitchen',
        folder: 'kitchenBar',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    kitchenBarEnd: {
        name: 'Конец барной стойки',
        category: 'kitchen',
        folder: 'kitchenBarEnd',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenBlender: {
        name: 'Блендер',
        category: 'kitchen',
        folder: 'kitchenBlender',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenCabinet: {
        name: 'Кухонный шкаф',
        category: 'kitchen',
        folder: 'kitchenCabinet',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenCabinetCornerInner: {
        name: 'Внутренний угловой шкаф',
        category: 'kitchen',
        folder: 'kitchenCabinetCornerInner',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenCabinetCornerRound: {
        name: 'Закругленный угловой шкаф',
        category: 'kitchen',
        folder: 'kitchenCabinetCornerRound',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenCabinetDrawer: {
        name: 'Шкаф с ящиком',
        category: 'kitchen',
        folder: 'kitchenCabinetDrawer',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenCabinetUpper: {
        name: 'Верхний шкаф',
        category: 'kitchen',
        folder: 'kitchenCabinetUpper',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenCabinetUpperCorner: {
        name: 'Верхний угловой шкаф',
        category: 'kitchen',
        folder: 'kitchenCabinetUpperCorner',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenCabinetUpperDouble: {
        name: 'Двойной верхний шкаф',
        category: 'kitchen',
        folder: 'kitchenCabinetUpperDouble',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    kitchenCabinetUpperLow: {
        name: 'Низкий верхний шкаф',
        category: 'kitchen',
        folder: 'kitchenCabinetUpperLow',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenCoffeeMachine: {
        name: 'Кофемашина',
        category: 'kitchen',
        folder: 'kitchenCoffeeMachine',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenFridge: {
        name: 'Холодильник',
        category: 'kitchen',
        folder: 'kitchenFridge',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenFridgeBuiltIn: {
        name: 'Встроенный холодильник',
        category: 'kitchen',
        folder: 'kitchenFridgeBuiltIn',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenFridgeLarge: {
        name: 'Большой холодильник',
        category: 'kitchen',
        folder: 'kitchenFridgeLarge',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenFridgeSmall: {
        name: 'Маленький холодильник',
        category: 'kitchen',
        folder: 'kitchenFridgeSmall',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenMicrowave: {
        name: 'Микроволновка',
        category: 'kitchen',
        folder: 'kitchenMicrowave',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenSink: {
        name: 'Кухонная мойка',
        category: 'kitchen',
        folder: 'kitchenSink',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenStove: {
        name: 'Плита',
        category: 'kitchen',
        folder: 'kitchenStove',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    kitchenStoveElectric: {
        name: 'Электроплита',
        category: 'kitchen',
        folder: 'kitchenStoveElectric',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    stoolBar: {
        name: 'Барный стул',
        category: 'kitchen',
        folder: 'stoolBar',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    stoolBarSquare: {
        name: 'Квадратный барный стул',
        category: 'kitchen',
        folder: 'stoolBarSquare',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    table: {
        name: 'Стол',
        category: 'kitchen',
        folder: 'table',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    tableCloth: {
        name: 'Стол со скатертью',
        category: 'kitchen',
        folder: 'tableCloth',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    tableCoffee: {
        name: 'Журнальный столик',
        category: 'kitchen',
        folder: 'tableCoffee',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    tableCoffeeGlass: {
        name: 'Стеклянный журнальный столик',
        category: 'kitchen',
        folder: 'tableCoffeeGlass',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    tableCoffeeGlassSquare: {
        name: 'Квадратный стеклянный столик',
        category: 'kitchen',
        folder: 'tableCoffeeGlassSquare',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    tableCoffeeSquare: {
        name: 'Квадратный журнальный столик',
        category: 'kitchen',
        folder: 'tableCoffeeSquare',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    tableCross: {
        name: 'Стол с перекрестными ножками',
        category: 'kitchen',
        folder: 'tableCross',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    tableCrossCloth: {
        name: 'Стол с перекрестными ножками и скатертью',
        category: 'kitchen',
        folder: 'tableCrossCloth',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    tableGlass: {
        name: 'Стеклянный стол',
        category: 'kitchen',
        folder: 'tableGlass',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    tableRound: {
        name: 'Круглый стол',
        category: 'kitchen',
        folder: 'tableRound',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    toaster: {
        name: 'Тостер',
        category: 'kitchen',
        folder: 'toaster',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    trashcan: {
        name: 'Мусорное ведро',
        category: 'kitchen',
        folder: 'trashcan',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },

    // ============ ГОСТИНАЯ (livingroom) ============
    bench: {
        name: 'Скамья',
        category: 'livingroom',
        folder: 'bench',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    benchCushion: {
        name: 'Скамья с подушкой',
        category: 'livingroom',
        folder: 'benchCushion',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    benchCushionLow: {
        name: 'Низкая скамья с подушкой',
        category: 'livingroom',
        folder: 'benchCushionLow',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    bookcaseClosed: {
        name: 'Закрытый книжный шкаф',
        category: 'livingroom',
        folder: 'bookcaseClosed',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    bookcaseClosedDoors: {
        name: 'Книжный шкаф с дверцами',
        category: 'livingroom',
        folder: 'bookcaseClosedDoors',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    bookcaseClosedWide: {
        name: 'Широкий закрытый книжный шкаф',
        category: 'livingroom',
        folder: 'bookcaseClosedWide',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    bookcaseOpen: {
        name: 'Открытый книжный шкаф',
        category: 'livingroom',
        folder: 'bookcaseOpen',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    bookcaseOpenLow: {
        name: 'Низкий открытый книжный шкаф',
        category: 'livingroom',
        folder: 'bookcaseOpenLow',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    cabinetTelevision: {
        name: 'Тумба под телевизор',
        category: 'livingroom',
        folder: 'cabinetTelevision',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    cabinetTelevisionDoors: {
        name: 'Тумба под телевизор с дверцами',
        category: 'livingroom',
        folder: 'cabinetTelevisionDoors',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    chairDesk: {
        name: 'Офисный стул',
        category: 'livingroom',
        folder: 'chairDesk',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    chairModernCushion: {
        name: 'Современный стул с подушкой',
        category: 'livingroom',
        folder: 'chairModernCushion',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    chairModernFrameCushion: {
        name: 'Стул с подушкой на каркасе',
        category: 'livingroom',
        folder: 'chairModernFrameCushion',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    desk: {
        name: 'Письменный стол',
        category: 'livingroom',
        folder: 'desk',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    deskCorner: {
        name: 'Угловой стол',
        category: 'livingroom',
        folder: 'deskCorner',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    loungeChair: {
        name: 'Кресло',
        category: 'livingroom',
        folder: 'loungeChair',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    loungeChairRelax: {
        name: 'Кресло для отдыха',
        category: 'livingroom',
        folder: 'loungeChairRelax',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    loungeDesignChair: {
        name: 'Дизайнерское кресло',
        category: 'livingroom',
        folder: 'loungeDesignChair',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    loungeDesignSofa: {
        name: 'Дизайнерский диван',
        category: 'livingroom',
        folder: 'loungeDesignSofa',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    loungeDesignSofaCorner: {
        name: 'Угловой дизайнерский диван',
        category: 'livingroom',
        folder: 'loungeDesignSofaCorner',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 2]
    },
    loungeSofa: {
        name: 'Диван',
        category: 'livingroom',
        folder: 'loungeSofa',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    loungeSofaCorner: {
        name: 'Угловой диван',
        category: 'livingroom',
        folder: 'loungeSofaCorner',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 2]
    },
    loungeSofaLong: {
        name: 'Длинный диван',
        category: 'livingroom',
        folder: 'loungeSofaLong',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [3, 1]
    },
    loungeSofaOttoman: {
        name: 'Диван с оттоманкой',
        category: 'livingroom',
        folder: 'loungeSofaOttoman',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [2, 1]
    },
    sideTable: {
        name: 'Приставной столик',
        category: 'livingroom',
        folder: 'sideTable',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },
    sideTableDrawers: {
        name: 'Приставной столик с ящиками',
        category: 'livingroom',
        folder: 'sideTableDrawers',
        rotations: ['NE', 'NW', 'SE', 'SW'],
        size: [1, 1]
    },

    // ============ ГОТОВЫЕ КОРПУСА КОМНАТ (rooms) ============
    roomKitchen: {
        name: 'Кухонный гарнитур',
        category: 'rooms',
        folder: 'roomKitchen',
        rotations: ['NE'],
        size: [4, 2]
    },
    roomKitchen2: {
        name: 'Кухонный гарнитур 2',
        category: 'rooms',
        folder: 'roomKitchen',
        rotations: ['NE'],
        size: [4, 2]
    },
    roomBathroom: {
        name: 'Ванная комната',
        category: 'rooms',
        folder: 'roomBathroom',
        rotations: ['NE'],
        size: [3, 2]
    },
    roomBedroom: {
        name: 'Спальня',
        category: 'rooms',
        folder: 'roomBedroom',
        rotations: ['NE'],
        size: [4, 3]
    },
    roomLivingroom: {
        name: 'Гостиная',
        category: 'rooms',
        folder: 'roomLivingroom',
        rotations: ['NE'],
        size: [5, 3]
    },
    roomLivingroom2: {
        name: 'Гостиная 2',
        category: 'rooms',
        folder: 'roomLivingroom',
        rotations: ['NE'],
        size: [5, 3]
    },
    roomOffice: {
        name: 'Кабинет',
        category: 'rooms',
        folder: 'roomOffice',
        rotations: ['NE'],
        size: [4, 3]
    },
    roomKids: {
        name: 'Детская',
        category: 'rooms',
        folder: 'roomKids',
        rotations: ['NE'],
        size: [4, 3]
    },
    roomKids2: {
        name: 'Детская 2',
        category: 'rooms',
        folder: 'roomKids',
        rotations: ['NE'],
        size: [4, 3]
    }
};

// Пути к папкам
export const paths = {
    base: 'base',
    bathroom: 'bathroom',
    bedroom: 'bedroom',
    decor: 'decor',
    electronics: 'electronics',
    kitchen: 'kitchen',
    livingroom: 'livingroom',
    rooms: 'rooms'
};

// Получить все предметы категории
export function getItemsByCategory(category) {
    return Object.entries(furnitureData)
        .filter(([_, data]) => data.category === category)
        .map(([key, data]) => ({ key, ...data }));
}