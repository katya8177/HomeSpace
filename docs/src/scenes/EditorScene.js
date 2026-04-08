// docs/src/scenes/EditorScene.js
import Phaser from 'phaser';

export class EditorScene extends Phaser.Scene {
    constructor() {
        super({ key: 'EditorScene' });
        
        this.furnitureGroup = null;
        this.selectedItem = null;
        this.snapToGrid = false;
        this.gridSize = 40;
        this.currentDirection = 'NE';
        this.directions = ['NE', 'NW', 'SE', 'SW'];
        this.placementMode = false;
        this.selectedFurnitureId = null;
        this.currentRoom = 'default';
        this.rooms = {};
        this.currentCategory = 'all';
        this.searchQuery = '';
        
        this.instructionText = null;
        this.gridGraphics = null;
        this.background = null;
        this.isMobile = false;
        
        this.furnitureCatalog = [
            { id: 'wall', name: 'Стена', category: 'base', path: 'base/wall', hasDirections: true },
            { id: 'floorFull', name: 'Пол', category: 'base', path: 'base/floorFull', hasDirections: false },
            { id: 'toilet', name: 'Унитаз', category: 'bathroom', path: 'bathroom/toilet', hasDirections: true },
            { id: 'shower', name: 'Душ', category: 'bathroom', path: 'bathroom/shower', hasDirections: true },
            { id: 'bathtub', name: 'Ванна', category: 'bathroom', path: 'bathroom/bathtub', hasDirections: true },
            { id: 'bedDouble', name: 'Кровать', category: 'bedroom', path: 'bedroom/bedDouble', hasDirections: true },
            { id: 'kitchenStove', name: 'Плита', category: 'kitchen', path: 'kitchen/kitchenStove', hasDirections: true },
            { id: 'kitchenFridge', name: 'Холодильник', category: 'kitchen', path: 'kitchen/kitchenFridge', hasDirections: true },
            { id: 'table', name: 'Стол', category: 'kitchen', path: 'kitchen/table', hasDirections: false },
            { id: 'chair', name: 'Стул', category: 'kitchen', path: 'kitchen/chair', hasDirections: true },
            { id: 'loungeSofa', name: 'Диван', category: 'livingroom', path: 'livingroom/loungeSofa', hasDirections: true },
            { id: 'tableCoffee', name: 'Журн. столик', category: 'livingroom', path: 'livingroom/tableCoffee', hasDirections: false },
            { id: 'televisionModern', name: 'Телевизор', category: 'electronics', path: 'electronics/televisionModern', hasDirections: true },
            { id: 'pottedPlant', name: 'Растение', category: 'decor', path: 'decor/pottedPlant', hasDirections: false },
            { id: 'lampRoundTable', name: 'Лампа', category: 'decor', path: 'decor/lampRoundTable', hasDirections: false }
        ];
        
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    preload() {
        console.log('📦 Загрузка моделей...');
        const basePath = '/assets/furniture/';
        
        this.furnitureCatalog.forEach(item => {
            if (item.hasDirections) {
                this.directions.forEach(dir => {
                    this.load.image(`${item.id}_${dir}`, `${basePath}${item.path}/${item.id}_${dir}.png`);
                });
            } else {
                this.load.image(item.id, `${basePath}${item.path}/${item.id}_NE.png`);
            }
        });
        
        ['default', 'bedroom', 'kitchen', 'bathroom'].forEach(bg => {
            this.load.image(`bg_${bg}`, `${basePath}backgrounds/${bg}.png`);
        });
        
        this.load.on('loaderror', (file) => console.warn(`⚠️ Не загружено: ${file.src}`));
        this.load.on('complete', () => console.log('✅ Модели загружены'));
    }

    create() {
        console.log('🎮 Create started', this.isMobile ? 'mobile mode' : 'desktop mode');
        
        if (!this.cameras?.main) {
            this.time.delayedCall(100, () => this.create());
            return;
        }
        
        this.furnitureGroup = this.add.group();
        this.loadRooms();
        this.setBackground();
        this.createGrid();
        this.setupInput();
        this.loadCurrentRoom();
        this.updateFurnitureUI();
        this.updateRoomsUI();
        this.createInstruction();
        this.setupUIEvents();
        
        if (this.isMobile) this.addMobileControls();
        
        console.log('✅ EditorScene ready');
    }
    
    addMobileControls() {
        const controls = [
            { icon: '🗑', action: 'delete', x: 70, y: 700 },
            { icon: '🔄', action: 'rotate', x: 140, y: 700 },
            { icon: '📐', action: 'grid', x: 210, y: 700 },
            { icon: '🔒', action: 'lock', x: 280, y: 700 },
            { icon: '🔓', action: 'unlock', x: 350, y: 700 }
        ];
        
        controls.forEach(ctrl => {
            const btn = this.add.text(ctrl.x, ctrl.y, ctrl.icon, {
                fontSize: '28px',
                backgroundColor: '#000000aa',
                padding: { x: 8, y: 5 },
                borderRadius: 30
            }).setInteractive({ useHandCursor: true }).setDepth(1000);
            
            btn.on('pointerdown', () => {
                switch(ctrl.action) {
                    case 'delete': this.deleteSelected(); break;
                    case 'rotate': this.rotateDirection(1); break;
                    case 'grid': this.toggleSnap(); break;
                    case 'lock': this.lockSelected(); break;
                    case 'unlock': this.unlockSelected(); break;
                }
            });
        });
    }
    
    // Закрепить выделенный предмет
    lockSelected() {
        if (this.selectedItem) {
            this.selectedItem.setData('locked', true);
            this.selectedItem.setTint(0xff6666); // Красноватый оттенок для закрепленных
            this.showMessage(`🔒 ${this.selectedItem.getData('name') || 'Предмет'} закреплен`);
            this.saveCurrentRoom();
        } else {
            this.showMessage('Сначала выберите предмет');
        }
    }
    
    // Разблокировать выделенный предмет
    unlockSelected() {
        if (this.selectedItem) {
            this.selectedItem.setData('locked', false);
            this.selectedItem.clearTint();
            this.selectedItem.setTint(0xffaa00); // Возвращаем желтый для выделенного
            this.showMessage(`🔓 ${this.selectedItem.getData('name') || 'Предмет'} разблокирован`);
            this.saveCurrentRoom();
        } else {
            this.showMessage('Сначала выберите предмет');
        }
    }
    
    // Проверка, заблокирован ли предмет
    isLocked(item) {
        return item.getData('locked') === true;
    }
    
    loadRooms() {
        const saved = localStorage.getItem('homespace_rooms');
        if (saved) {
            try { this.rooms = JSON.parse(saved); } catch(e) {}
        }
        
        if (Object.keys(this.rooms).length === 0) {
            this.rooms = {
                default: { id: 'default', name: 'Моя комната', background: 'bg_default', items: [] }
            };
            this.saveRooms();
        }
    }
    
    saveRooms() {
        localStorage.setItem('homespace_rooms', JSON.stringify(this.rooms));
    }
    
    setBackground() {
        if (this.background) this.background.destroy();
        const bgKey = this.rooms[this.currentRoom]?.background || 'bg_default';
        if (this.textures.exists(bgKey)) {
            this.background = this.add.image(640, 400, bgKey);
            this.background.setDepth(-10);
        } else {
            this.cameras.main.setBackgroundColor('#1a1a2e');
        }
    }

    createGrid() {
        if (this.gridGraphics) this.gridGraphics.destroy();
        
        this.gridGraphics = this.add.graphics();
        this.gridGraphics.lineStyle(1, 0x4ecca3, 0.3);
        
        for (let x = 0; x <= 1280; x += this.gridSize) {
            this.gridGraphics.moveTo(x, 0);
            this.gridGraphics.lineTo(x, 800);
        }
        for (let y = 0; y <= 800; y += this.gridSize) {
            this.gridGraphics.moveTo(0, y);
            this.gridGraphics.lineTo(1280, y);
        }
        this.gridGraphics.strokePath();
        this.gridGraphics.setDepth(-5);
    }

    setupInput() {
        // Перетаскивание (только если предмет не заблокирован)
        this.input.on('drag', (pointer, obj, dragX, dragY) => {
            if (this.isLocked(obj)) return;
            if (this.snapToGrid) {
                dragX = Math.round(dragX / this.gridSize) * this.gridSize;
                dragY = Math.round(dragY / this.gridSize) * this.gridSize;
            }
            obj.x = dragX;
            obj.y = dragY;
            this.saveCurrentRoom();
        });
        
        // Выбор предмета
        this.input.on('gameobjectdown', (pointer, obj) => {
            if (pointer.event.ctrlKey || (this.isMobile && pointer.event.touches && pointer.event.touches.length === 2)) {
                this.cycleDepth(obj);
            } else {
                this.selectItem(obj);
            }
        });
        
        // Отмена выбора
        this.input.on('pointerdown', (pointer) => {
            const hits = this.input.hitTestPointer(pointer);
            if (hits.length === 0 && this.selectedItem) {
                this.selectedItem.clearTint();
                this.selectedItem = null;
            }
        });
        
        // Клавиатура для десктопа
        if (!this.isMobile) {
            this.input.keyboard.on('keydown-DELETE', () => this.deleteSelected());
            this.input.keyboard.on('keydown-G', () => this.toggleSnap());
            this.input.keyboard.on('keydown-Q', () => this.rotateDirection(-1));
            this.input.keyboard.on('keydown-E', () => this.rotateDirection(1));
            this.input.keyboard.on('keydown-ESC', () => this.exitPlacementMode());
            this.input.keyboard.on('keydown-PAGE_UP', () => this.bringToFront());
            this.input.keyboard.on('keydown-PAGE_DOWN', () => this.sendToBack());
            this.input.keyboard.on('keydown-L', () => this.lockSelected());
            this.input.keyboard.on('keydown-U', () => this.unlockSelected());
        }
        
        // Масштабирование колесиком (только если не заблокирован)
        this.input.on('wheel', (pointer, obj, deltaX, deltaY) => {
            if (this.selectedItem && !this.isLocked(this.selectedItem)) {
                const newScale = Math.max(0.3, Math.min(2, this.selectedItem.scale - deltaY / 500));
                this.selectedItem.setScale(newScale);
                this.saveCurrentRoom();
                this.showMessage(`Масштаб: ${newScale.toFixed(1)}x`);
            } else if (this.selectedItem && this.isLocked(this.selectedItem)) {
                this.showMessage('🔒 Предмет закреплен, сначала разблокируйте (U)');
            }
        });
    }
    
    cycleDepth(item) {
        if (this.isLocked(item)) {
            this.showMessage('🔒 Предмет закреплен, сначала разблокируйте');
            return;
        }
        let newDepth = item.depth + 10;
        if (newDepth > 100) newDepth = 1;
        item.setDepth(newDepth);
        this.showMessage(`Слой: ${newDepth}`);
        this.saveCurrentRoom();
    }
    
    bringToFront() {
        if (this.selectedItem && !this.isLocked(this.selectedItem)) {
            this.selectedItem.setDepth(100);
            this.showMessage('На передний план');
            this.saveCurrentRoom();
        } else if (this.selectedItem && this.isLocked(this.selectedItem)) {
            this.showMessage('🔒 Предмет закреплен, сначала разблокируйте');
        }
    }
    
    sendToBack() {
        if (this.selectedItem && !this.isLocked(this.selectedItem)) {
            this.selectedItem.setDepth(1);
            this.showMessage('На задний план');
            this.saveCurrentRoom();
        } else if (this.selectedItem && this.isLocked(this.selectedItem)) {
            this.showMessage('🔒 Предмет закреплен, сначала разблокируйте');
        }
    }
    
    selectItem(item) {
        if (this.selectedItem) {
            this.selectedItem.clearTint();
        }
        this.selectedItem = item;
        
        // Разный цвет для заблокированных и обычных
        if (this.isLocked(item)) {
            this.selectedItem.setTint(0xff6666);
            this.showMessage(`🔒 ${item.getData('name') || 'Предмет'} (закреплен)`);
        } else {
            this.selectedItem.setTint(0xffaa00);
            this.showMessage(`📌 ${item.getData('name') || 'Предмет'} выбран`);
        }
    }
    
    deleteSelected() {
        if (this.selectedItem && !this.isLocked(this.selectedItem)) {
            this.selectedItem.destroy();
            this.selectedItem = null;
            this.saveCurrentRoom();
            this.showMessage('🗑 Предмет удален');
        } else if (this.selectedItem && this.isLocked(this.selectedItem)) {
            this.showMessage('🔒 Предмет закреплен, сначала разблокируйте (U)');
        } else {
            this.showMessage('Сначала выберите предмет');
        }
    }
    
    showMessage(text) {
        const y = this.isMobile ? 120 : 100;
        const msg = this.add.text(640, y, text, {
            fontSize: this.isMobile ? '12px' : '14px',
            color: '#ffd700',
            backgroundColor: '#000000aa',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setDepth(1000);
        this.time.delayedCall(2000, () => msg.destroy());
    }

    addFurniture(furnitureId, x, y, direction = this.currentDirection) {
        const item = this.furnitureCatalog.find(f => f.id === furnitureId);
        if (!item) return null;
        
        const textureKey = item.hasDirections ? `${furnitureId}_${direction}` : furnitureId;
        
        if (!this.textures.exists(textureKey)) {
            console.warn(`⚠️ Текстура не найдена: ${textureKey}`);
            return null;
        }
        
        const sprite = this.add.sprite(x, y, textureKey);
        sprite.setData('type', furnitureId);
        sprite.setData('direction', direction);
        sprite.setData('name', item.name);
        sprite.setData('locked', false); // Новые предметы не заблокированы
        sprite.setInteractive({ draggable: true, cursor: 'grab', useHandCursor: true });
        sprite.setDepth(1);
        sprite.setScale(1);
        
        sprite.on('pointerover', () => {
            if (this.selectedItem !== sprite && !this.isLocked(sprite)) sprite.setTint(0x88ff88);
        });
        sprite.on('pointerout', () => {
            if (this.selectedItem !== sprite) sprite.clearTint();
        });
        
        this.furnitureGroup.add(sprite);
        this.saveCurrentRoom();
        
        return sprite;
    }

    createInstruction() {
        if (this.instructionText) this.instructionText.destroy();
        
        const text = this.isMobile 
            ? '🖱 Нажми на предмет → на поле | 🗑 Delete | 🔄 Поворот | 🔒/🔓 Закрепить'
            : '🖱 Выберите предмет → клик на поле | 🗑 Delete | 🔄 Q/E поворот | 🖱 Колёсико масштаб | 🔒 L закрепить | 🔓 U разблокировать | 📌 Ctrl+клик слой | 📄 PageUp/PageDown | G сетка';
        
        this.instructionText = this.add.text(640, this.isMobile ? 720 : 750, text, {
            fontSize: this.isMobile ? '9px' : '11px',
            color: '#ffffff',
            backgroundColor: '#000000aa',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setDepth(1000);
    }

    enterPlacementMode(furnitureId) {
        this.placementMode = true;
        this.selectedFurnitureId = furnitureId;
        
        if (this.instructionText) this.instructionText.destroy();
        this.instructionText = this.add.text(640, 70, 
            `📌 Размещение: ${furnitureId} | ESC выход | ${this.isMobile ? '🔄 кнопка поворота' : 'Q/E поворот'}`, 
            {
                fontSize: this.isMobile ? '12px' : '14px',
                color: '#ffd700',
                backgroundColor: '#000000aa',
                padding: { x: 10, y: 5 }
            }
        ).setOrigin(0.5).setDepth(1000);
        
        const clickHandler = (pointer) => {
            if (this.placementMode && this.selectedFurnitureId) {
                let x = pointer.worldX;
                let y = pointer.worldY;
                if (this.snapToGrid) {
                    x = Math.round(x / this.gridSize) * this.gridSize;
                    y = Math.round(y / this.gridSize) * this.gridSize;
                }
                this.addFurniture(this.selectedFurnitureId, x, y, this.currentDirection);
            }
        };
        
        this.input.once('pointerdown', clickHandler);
    }

    exitPlacementMode() {
        this.placementMode = false;
        this.selectedFurnitureId = null;
        if (this.instructionText) this.instructionText.destroy();
        this.createInstruction();
    }

    rotateDirection(delta) {
        const currentIndex = this.directions.indexOf(this.currentDirection);
        const newIndex = (currentIndex + delta + this.directions.length) % this.directions.length;
        this.currentDirection = this.directions[newIndex];
        this.showMessage(`Поворот: ${this.currentDirection} (${delta > 0 ? 'E' : 'Q'})`);
    }

    toggleSnap() {
        this.snapToGrid = !this.snapToGrid;
        const snapBtn = document.getElementById('snap-toggle');
        if (snapBtn) {
            snapBtn.textContent = this.snapToGrid ? '📐 Сетка: вкл' : '📐 Сетка: выкл';
        }
        this.showMessage(this.snapToGrid ? 'Сетка включена (G)' : 'Сетка выключена (G)');
    }

    updateFurnitureUI() {
        const container = document.getElementById('furniture-list');
        if (!container) return;
        
        let filtered = [...this.furnitureCatalog];
        if (this.currentCategory !== 'all') {
            filtered = filtered.filter(f => f.category === this.currentCategory);
        }
        if (this.searchQuery) {
            filtered = filtered.filter(f => f.name.toLowerCase().includes(this.searchQuery.toLowerCase()));
        }
        
        if (filtered.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:20px;">🔍 Ничего не найдено</div>';
            return;
        }
        
        container.innerHTML = filtered.map(item => `
            <div class="furniture-item" data-id="${item.id}">
                <div class="furniture-emoji">${this.getPreviewIcon(item.id)}</div>
                <div class="furniture-name">${item.name}</div>
                <div class="furniture-meta">${item.category}</div>
            </div>
        `).join('');
        
        container.querySelectorAll('.furniture-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                container.querySelectorAll('.furniture-item').forEach(i => i.style.background = '');
                el.style.background = 'rgba(78,204,163,0.3)';
                this.enterPlacementMode(id);
            });
        });
    }
    
    getPreviewIcon(id) {
        const icons = {
            wall: '🧱', toilet: '🚽', shower: '🚿', bathtub: '🛁',
            bedDouble: '🛏', kitchenStove: '🍳', kitchenFridge: '🧊',
            table: '🍽', chair: '🪑', loungeSofa: '🛋', televisionModern: '📺',
            pottedPlant: '🌵', lampRoundTable: '💡', tableCoffee: '☕'
        };
        return icons[id] || '🪑';
    }
    
    updateRoomsUI() {
        const container = document.getElementById('rooms-list');
        if (!container) return;
        
        container.innerHTML = Object.values(this.rooms).map(room => `
            <div class="room-item ${room.id === this.currentRoom ? 'active' : ''}" data-room-id="${room.id}">
                <span>${room.name}</span>
                <div>
                    <button class="room-select-btn" data-room-id="${room.id}">📂</button>
                    ${room.id !== 'default' ? `<button class="room-delete-btn" data-room-id="${room.id}">🗑</button>` : ''}
                </div>
            </div>
        `).join('');
        
        container.querySelectorAll('.room-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.switchRoom(btn.dataset.roomId);
            });
        });
        
        container.querySelectorAll('.room-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteRoom(btn.dataset.roomId);
            });
        });
        
        container.querySelectorAll('.room-item').forEach(item => {
            item.addEventListener('click', () => this.switchRoom(item.dataset.roomId));
        });
    }
    
    createNewRoom() {
        const name = prompt('Название комнаты:', 'Новая комната');
        if (!name) return;
        
        const id = 'room_' + Date.now();
        this.rooms[id] = { id, name, background: 'bg_default', items: [] };
        this.saveRooms();
        this.updateRoomsUI();
        this.switchRoom(id);
        this.showMessage(`Комната "${name}" создана`);
    }
    
    deleteRoom(roomId) {
        if (confirm(`Удалить "${this.rooms[roomId]?.name}"?`)) {
            delete this.rooms[roomId];
            localStorage.removeItem(`homespace_room_${roomId}`);
            this.saveRooms();
            this.updateRoomsUI();
            if (this.currentRoom === roomId) this.switchRoom('default');
            this.showMessage('Комната удалена');
        }
    }
    
    switchRoom(roomId) {
        if (!this.rooms[roomId]) return;
        
        this.saveCurrentRoom();
        this.currentRoom = roomId;
        this.setBackground();
        this.loadCurrentRoom();
        this.updateRoomsUI();
        this.showMessage(`Переключено на: ${this.rooms[roomId].name}`);
    }
    
    saveCurrentRoom() {
        const items = [];
        this.furnitureGroup.getChildren().forEach(sprite => {
            items.push({
                type: sprite.getData('type'),
                x: sprite.x,
                y: sprite.y,
                direction: sprite.getData('direction') || 'NE',
                scale: sprite.scale,
                depth: sprite.depth,
                locked: sprite.getData('locked') || false
            });
        });
        
        if (this.rooms[this.currentRoom]) {
            this.rooms[this.currentRoom].items = items;
            this.saveRooms();
        }
    }
    
    loadCurrentRoom() {
        this.furnitureGroup.getChildren().forEach(sprite => sprite.destroy());
        this.furnitureGroup.clear(true, true);
        this.selectedItem = null;
        
        const room = this.rooms[this.currentRoom];
        if (room?.items) {
            room.items.forEach(item => {
                const sprite = this.addFurniture(item.type, item.x, item.y, item.direction);
                if (sprite) {
                    if (item.scale) sprite.setScale(item.scale);
                    if (item.depth) sprite.setDepth(item.depth);
                    if (item.locked) {
                        sprite.setData('locked', true);
                        sprite.setTint(0xff6666);
                    }
                }
            });
        }
    }
    
    changeBackground(bgKey) {
        if (this.rooms[this.currentRoom]) {
            this.rooms[this.currentRoom].background = bgKey;
            this.saveRooms();
            this.setBackground();
            this.showMessage('Фон изменен');
        }
    }
    
    uploadBackground() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const bgKey = 'custom_' + Date.now();
                    this.load.image(bgKey, event.target.result);
                    this.load.once('filecomplete-image-' + bgKey, () => {
                        if (this.rooms[this.currentRoom]) {
                            this.rooms[this.currentRoom].background = bgKey;
                            this.saveRooms();
                            this.setBackground();
                            this.showMessage('Свой фон загружен');
                        }
                    });
                    this.load.start();
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }

    setupUIEvents() {
        document.querySelectorAll('[data-category]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-category]').forEach(b => b.setAttribute('aria-selected', 'false'));
                btn.setAttribute('aria-selected', 'true');
                this.currentCategory = btn.dataset.category;
                this.updateFurnitureUI();
            });
        });
        
        const searchInput = document.getElementById('furniture-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.updateFurnitureUI();
            });
        }
        
        const newRoomBtn = document.getElementById('new-room-btn');
        if (newRoomBtn) newRoomBtn.addEventListener('click', () => this.createNewRoom());
        
        const bgSelect = document.getElementById('bg-select');
        if (bgSelect) {
            bgSelect.innerHTML = `
                <option value="bg_default">🏠 Стандартный</option>
                <option value="bg_bedroom">🛏 Спальня</option>
                <option value="bg_kitchen">🍳 Кухня</option>
                <option value="bg_bathroom">🚿 Ванная</option>
            `;
            bgSelect.onchange = (e) => this.changeBackground(e.target.value);
        }
        
        const uploadBgBtn = document.getElementById('upload-bg-btn');
        if (uploadBgBtn) uploadBgBtn.addEventListener('click', () => this.uploadBackground());
        
        // Кнопки закрепления в панели
        const lockBtn = document.getElementById('lock-selected');
        const unlockBtn = document.getElementById('unlock-selected');
        if (lockBtn) lockBtn.addEventListener('click', () => this.lockSelected());
        if (unlockBtn) unlockBtn.addEventListener('click', () => this.unlockSelected());
    }
}

export default EditorScene;