// src/scenes/EditorScene.js
import Phaser from 'phaser';
import { furnitureData } from '../config/furniture.js';
import { api } from '../services/api.js';

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
        this.currentRoomId = null;
        this.currentRoomName = 'default';
        this.rooms = {};
        this.currentCategory = 'all';
        this.searchQuery = '';
        
        this.instructionText = null;
        this.gridGraphics = null;
        this.background = null;
        this.isMobile = false;
        
        this.readOnlyMode = false;
        this.parentMode = false;
        this.viewingChildId = null;
        this.parentPanel = null;
        this.parentPanelCollapsed = false;
        this.currentUser = null;
        this.familyMembers = [];
        this.children = [];
        this.backButton = null;
        
        // Для одно-кликового размещения
        this.pendingFurnitureId = null;
        this.previewSprite = null;
        
        this.furnitureCatalog = Object.entries(furnitureData).map(([id, data]) => ({
            id,
            name: data.name,
            category: data.category,
            path: `${data.category}/${data.folder}`,
            rotations: data.rotations || ['NE'],
            hasDirections: (data.rotations?.length || 0) > 1
        }));
        
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    preload() {
        console.log('📦 Загрузка моделей...');
        const basePath = 'assets/furniture/';
        
        this.furnitureCatalog.forEach(item => {
            item.rotations.forEach(dir => {
                const textureKey = `${item.id}_${dir}`;
                const filePath = `${basePath}${item.path}/${item.id}_${dir}.png`;
                this.load.image(textureKey, filePath);
            });
        });
        
        ['default', 'bedroom', 'kitchen', 'bathroom', 'livingroom'].forEach(bg => {
            this.load.image(`bg_${bg}`, `${basePath}backgrounds/${bg}.png`);
        });
        
        this.load.on('loaderror', (file) => console.warn(`⚠️ Не загружено: ${file.src}`));
        this.load.on('complete', () => console.log('✅ Модели загружены'));
    }

    async create() {
        const userStr = localStorage.getItem('homespace_currentUser');
        if (userStr) {
            try {
                this.currentUser = JSON.parse(userStr);
                console.log('✅ Пользователь загружен:', this.currentUser.name, 'роль:', this.currentUser.role);
            } catch(e) {}
        }
        
        if (!this.currentUser) {
            window.location.href = '/';
            return;
        }
        
        this.parentMode = this.currentUser.role === 'parent';
        
        this.furnitureGroup = this.add.group();
        
        await this.loadRoomsFromDB();
        
        if (this.parentMode && this.currentUser.familyId) {
            await this.loadFamilyMembers();
            this.createParentPanel();
        }
        
        this.setBackground();
        this.createGrid();
        this.setupInput();
        this.loadCurrentRoom();
        this.updateFurnitureUI();
        this.updateRoomsUI();
        this.createInstruction();
        this.setupUIEvents();
        this.setupModalClose();

        setTimeout(() => this.refreshTaskMarkers(), 1000);
        
        if (this.isMobile) this.addMobileControls();
        
        // === ИСПРАВЛЕНИЕ: СЛОИ ===
        this.input.keyboard.on('keydown-PAGE_UP', () => {
            if (this.selectedItem && !this.readOnlyMode) {
                let newDepth = (this.selectedItem.depth || 1) + 1;
                this.selectedItem.setDepth(newDepth);
                this.showMessage(`Слой: ${newDepth}`);
                this.saveCurrentRoomToDB();
            }
        });
        
        this.input.keyboard.on('keydown-PAGE_DOWN', () => {
            if (this.selectedItem && !this.readOnlyMode) {
                let newDepth = Math.max(1, (this.selectedItem.depth || 1) - 1);
                this.selectedItem.setDepth(newDepth);
                this.showMessage(`Слой: ${newDepth}`);
                this.saveCurrentRoomToDB();
            }
        });
        
        console.log('✅ EditorScene ready');
    }
    
    // === ИСПРАВЛЕНИЕ: ПЕРЕМЕЩЕНИЕ ПРЕДМЕТОВ (работает и на тач) ===
    setupInput() {
        // Drag для перемещения
        this.input.on('drag', (pointer, obj, dragX, dragY) => {
            if (this.readOnlyMode) return;
            if (this.isLocked(obj)) return;
            
            if (this.snapToGrid) {
                dragX = Math.round(dragX / this.gridSize) * this.gridSize;
                dragY = Math.round(dragY / this.gridSize) * this.gridSize;
            }
            obj.x = dragX;
            obj.y = dragY;
            this.saveCurrentRoomToDB();
        });
        
        // Выбор предмета (одинарный клик/тап)
        this.input.on('gameobjectdown', (pointer, obj) => {
            if (this.readOnlyMode) return;
            
            // Если есть pending предмет - размещаем
            if (this.pendingFurnitureId) {
                this.placePendingItem(pointer);
                return;
            }
            
            this.selectItem(obj);
        });
        
        // Размещение pending предмета по клику на пустое место
        this.input.on('pointerdown', (pointer) => {
            if (this.readOnlyMode) return;
            
            if (this.pendingFurnitureId) {
                const hits = this.input.hitTestPointer(pointer);
                if (hits.length === 0) {
                    this.placePendingItem(pointer);
                }
                return;
            }
            
            // Сброс выделения при клике на пустоту
            const hits = this.input.hitTestPointer(pointer);
            if (hits.length === 0 && this.selectedItem) {
                if (this.selectedItem.clearTint) {
                    this.selectedItem.clearTint();
                }
                this.selectedItem = null;
                this.hidePreview();
            }
        });
        
        // Preview при движении
        this.input.on('pointermove', (pointer) => {
            if (this.pendingFurnitureId) {
                this.updatePreview(pointer);
            }
        });
        
        // Клавиатура
        if (!this.isMobile) {
            this.input.keyboard.on('keydown-DELETE', () => this.deleteSelected());
            this.input.keyboard.on('keydown-G', () => this.toggleSnap());
            this.input.keyboard.on('keydown-R', () => this.rotateSelected());
            this.input.keyboard.on('keydown-ESC', () => this.cancelPendingItem());
            this.input.keyboard.on('keydown-L', () => this.lockSelected());
            this.input.keyboard.on('keydown-U', () => this.unlockSelected());
        }
        
        // Масштабирование
        this.input.on('wheel', (pointer, obj, deltaX, deltaY) => {
            if (this.readOnlyMode) return;
            if (this.selectedItem && !this.isLocked(this.selectedItem)) {
                const newScale = Math.max(0.3, Math.min(2, this.selectedItem.scale - deltaY / 500));
                this.selectedItem.setScale(newScale);
                this.saveCurrentRoomToDB();
            }
        });
    }
    
    // === НОВЫЙ МЕТОД: РАЗМЕЩЕНИЕ PENDING ПРЕДМЕТА ===
    placePendingItem(pointer) {
        if (!this.pendingFurnitureId) return;
        
        let x = pointer.worldX;
        let y = pointer.worldY;
        if (this.snapToGrid) {
            x = Math.round(x / this.gridSize) * this.gridSize;
            y = Math.round(y / this.gridSize) * this.gridSize;
        }
        
        this.addFurniture(this.pendingFurnitureId, x, y, this.currentDirection);
        this.cancelPendingItem();
        this.showMessage('Предмет размещён', 'success');
    }
    
    // === ПРЕДПРОСМОТР ===
    updatePreview(pointer) {
        let x = pointer.worldX;
        let y = pointer.worldY;
        if (this.snapToGrid) {
            x = Math.round(x / this.gridSize) * this.gridSize;
            y = Math.round(y / this.gridSize) * this.gridSize;
        }
        
        if (!this.previewSprite) {
            const textureKey = `${this.pendingFurnitureId}_${this.currentDirection}`;
            if (this.textures.exists(textureKey)) {
                this.previewSprite = this.add.sprite(x, y, textureKey);
                this.previewSprite.setAlpha(0.6);
                this.previewSprite.setTint(0x88ff88);
                this.previewSprite.setDepth(1000);
            }
        } else {
            this.previewSprite.setPosition(x, y);
        }
    }
    
    hidePreview() {
        if (this.previewSprite) {
            this.previewSprite.destroy();
            this.previewSprite = null;
        }
    }
    
    cancelPendingItem() {
        this.pendingFurnitureId = null;
        this.hidePreview();
        this.createInstruction();
    }
    
    // === ВЫБОР ПРЕДМЕТА ИЗ КАТАЛОГА (ОДИН КЛИК) ===
    selectFurnitureFromCatalog(furnitureId) {
        if (this.readOnlyMode) {
            this.showMessage('❌ Режим только просмотра');
            return;
        }
        
        this.pendingFurnitureId = furnitureId;
        
        const item = this.furnitureCatalog.find(f => f.id === furnitureId);
        this.showMessage(`📌 ${item?.name || furnitureId} - нажмите на сетку для размещения`);
        
        // Обновляем инструкцию
        if (this.instructionText) this.instructionText.destroy();
        this.instructionText = this.add.text(640, this.isMobile ? 720 : 750, 
            `📌 Размещение: ${item?.name || furnitureId} | ESC отмена | R поворот`, {
            fontSize: '11px',
            color: '#ffd700',
            backgroundColor: '#000000aa',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setDepth(1000);
    }
    
    // === ПОВОРОТ ВЫДЕЛЕННОГО ПРЕДМЕТА ===
    rotateSelected() {
        if (this.readOnlyMode) return;
        if (this.selectedItem) {
            const currentDir = this.selectedItem.getData('direction') || 'NE';
            const currentIndex = this.directions.indexOf(currentDir);
            const newDir = this.directions[(currentIndex + 1) % this.directions.length];
            const furnitureId = this.selectedItem.getData('type');
            const textureKey = `${furnitureId}_${newDir}`;
            if (this.textures.exists(textureKey)) {
                this.selectedItem.setTexture(textureKey);
                this.selectedItem.setData('direction', newDir);
                this.saveCurrentRoomToDB();
                this.showMessage(`Поворот: ${newDir}`);
            }
        }
        
        // Также обновляем текущее направление для pending
        const currentIndex = this.directions.indexOf(this.currentDirection);
        this.currentDirection = this.directions[(currentIndex + 1) % this.directions.length];
        if (this.previewSprite) {
            const textureKey = `${this.pendingFurnitureId}_${this.currentDirection}`;
            if (this.textures.exists(textureKey)) {
                this.previewSprite.setTexture(textureKey);
            }
        }
    }
    
    // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===
    async loadRoomsFromDB() {
        try {
            const roomsFromDB = await api.getMyRooms();
            if (roomsFromDB && roomsFromDB.length > 0) {
                this.rooms = {};
                roomsFromDB.forEach(room => {
                    this.rooms[room.id] = {
                        id: room.id,
                        name: room.name,
                        background: room.background || 'bg_default',
                        items: room.items || []
                    };
                });
                this.currentRoomId = roomsFromDB[0].id;
                this.currentRoomName = roomsFromDB[0].name;
            } else {
                await this.createDefaultRoom();
            }
        } catch (error) {
            console.error('Ошибка загрузки комнат:', error);
            this.createLocalDefaultRoom();
        }
    }
    
    async createDefaultRoom() {
        try {
            const newRoom = await api.createRoom({
                name: 'Моя комната',
                background: 'bg_default',
                items: []
            });
            this.rooms = { [newRoom.id]: { ...newRoom, items: newRoom.items || [] } };
            this.currentRoomId = newRoom.id;
            this.currentRoomName = newRoom.name;
        } catch (error) {
            this.createLocalDefaultRoom();
        }
    }
    
    createLocalDefaultRoom() {
        const defaultId = 'default';
        this.rooms = { [defaultId]: { id: defaultId, name: 'Моя комната', background: 'bg_default', items: [] } };
        this.currentRoomId = defaultId;
        this.currentRoomName = 'Моя комната';
    }
    
    async saveCurrentRoomToDB() {
        if (this.readOnlyMode || !this.currentRoomId) return;
        
        const room = this.rooms[this.currentRoomId];
        if (!room) return;
        
        const items = [];
        this.furnitureGroup.getChildren().forEach(sprite => {
            let itemInstanceId = sprite.getData('itemInstanceId');
            if (!itemInstanceId) {
                itemInstanceId = `${sprite.getData('type')}_${Date.now()}_${Math.random()}`;
                sprite.setData('itemInstanceId', itemInstanceId);
            }
            items.push({
                type: sprite.getData('type'),
                itemInstanceId: itemInstanceId,
                x: sprite.x,
                y: sprite.y,
                direction: sprite.getData('direction') || 'NE',
                scale: sprite.scale,
                depth: sprite.depth,
                locked: sprite.getData('locked') || false
            });
        });
        
        try {
            if (this.currentRoomId !== 'default') {
                await api.updateRoom(this.currentRoomId, {
                    name: room.name,
                    background: room.background || 'bg_default',
                    items: items
                });
            }
            room.items = items;
        } catch (error) {
            console.error('Ошибка сохранения:', error);
        }
    }
    
    loadCurrentRoom() {
        this.furnitureGroup.getChildren().forEach(s => s.destroy());
        this.furnitureGroup.clear(true, true);
        this.selectedItem = null;
        
        const room = this.rooms[this.currentRoomId];
        if (!room) return;
        
        this.setBackground(room.background);
        
        if (room.items) {
            room.items.forEach(item => {
                const sprite = this.addFurniture(item.type, item.x, item.y, item.direction, item.itemInstanceId);
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
        
        this.updateRoomsUI();
        this.updateBackgroundSelect();
    }
    
    addFurniture(furnitureId, x, y, direction = 'NE', existingInstanceId = null) {
        const item = this.furnitureCatalog.find(f => f.id === furnitureId);
        if (!item) return null;
        
        const textureKey = `${furnitureId}_${direction}`;
        if (!this.textures.exists(textureKey)) return null;
        
        const sprite = this.add.sprite(x, y, textureKey);
        const uniqueId = existingInstanceId || `${furnitureId}_${Date.now()}_${Math.random()}`;
        
        sprite.setData('type', furnitureId);
        sprite.setData('itemInstanceId', uniqueId);
        sprite.setData('direction', direction);
        sprite.setData('name', item.name);
        sprite.setData('locked', false);
        sprite.setInteractive({ draggable: true });
        sprite.setDepth(1);
        
        sprite.on('pointerover', () => {
            if (this.selectedItem !== sprite && !this.isLocked(sprite)) sprite.setTint(0x88ff88);
        });
        sprite.on('pointerout', () => {
            if (this.selectedItem !== sprite) sprite.clearTint();
        });
        
        this.furnitureGroup.add(sprite);
        this.saveCurrentRoomToDB();
        
        return sprite;
    }
    
    selectItem(item) {
        if (this.readOnlyMode) return;
        if (this.selectedItem) this.selectedItem.clearTint();
        this.selectedItem = item;
        item.setTint(0xffaa00);
    }
    
    deleteSelected() {
        if (this.readOnlyMode || !this.selectedItem) return;
        if (this.isLocked(this.selectedItem)) {
            this.showMessage('🔒 Предмет закреплён');
            return;
        }
        this.selectedItem.destroy();
        this.selectedItem = null;
        this.saveCurrentRoomToDB();
        this.showMessage('🗑 Удалено');
    }
    
    lockSelected() {
        if (this.selectedItem) {
            this.selectedItem.setData('locked', true);
            this.selectedItem.setTint(0xff6666);
            this.saveCurrentRoomToDB();
        }
    }
    
    unlockSelected() {
        if (this.selectedItem) {
            this.selectedItem.setData('locked', false);
            this.selectedItem.clearTint();
            this.selectedItem.setTint(0xffaa00);
            this.saveCurrentRoomToDB();
        }
    }
    
    isLocked(item) {
        return item?.getData('locked') === true;
    }
    
    setBackground(bgKey = 'bg_default') {
        if (this.background) this.background.destroy();
        if (this.textures.exists(bgKey)) {
            this.background = this.add.image(640, 400, bgKey).setDepth(-10);
        } else {
            this.cameras.main.setBackgroundColor('#1a1a2e');
        }
    }
    
    createGrid() {
        if (this.gridGraphics) this.gridGraphics.destroy();
        this.gridGraphics = this.add.graphics();
        this.gridGraphics.lineStyle(1, 0x4ecca3, 0.3);
        for (let x = 0; x <= 1280; x += this.gridSize) {
            this.gridGraphics.moveTo(x, 0).lineTo(x, 800);
        }
        for (let y = 0; y <= 800; y += this.gridSize) {
            this.gridGraphics.moveTo(0, y).lineTo(1280, y);
        }
        this.gridGraphics.strokePath().setDepth(-5).setVisible(this.snapToGrid);
    }
    
    toggleSnap() {
        this.snapToGrid = !this.snapToGrid;
        if (this.gridGraphics) this.gridGraphics.setVisible(this.snapToGrid);
        const btn = document.getElementById('snap-toggle');
        if (btn) btn.textContent = this.snapToGrid ? '📐 Сетка: вкл' : '📐 Сетка: выкл';
        this.showMessage(this.snapToGrid ? 'Сетка включена' : 'Сетка выключена');
    }
    
    showMessage(text, type = 'info') {
        const y = this.isMobile ? 120 : 100;
        const color = type === 'success' ? '#4ecca3' : '#ffd700';
        const msg = this.add.text(640, y, text, {
            fontSize: this.isMobile ? '12px' : '14px',
            color: color,
            backgroundColor: '#000000aa',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setDepth(1000);
        this.time.delayedCall(2000, () => msg.destroy());
    }
    
    createInstruction() {
        if (this.instructionText) this.instructionText.destroy();
        let text = this.isMobile 
            ? '📱 Тап по предмету в панели → тап на сетку'
            : '🖱 Клик по предмету в панели → клик на сетку | R поворот | G сетка | Del удалить';
        this.instructionText = this.add.text(640, this.isMobile ? 720 : 750, text, {
            fontSize: '11px',
            color: '#ffffff',
            backgroundColor: '#000000aa',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setDepth(1000);
    }
    
    updateFurnitureUI() {
        const container = document.getElementById('furniture-list');
        if (!container) return;
        
        let filtered = this.furnitureCatalog.filter(f => 
            this.currentCategory === 'all' || f.category === this.currentCategory
        );
        
        if (this.searchQuery) {
            filtered = filtered.filter(f => 
                f.name.toLowerCase().includes(this.searchQuery.toLowerCase())
            );
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
                this.selectFurnitureFromCatalog(id);
            });
        });
    }
    
    getPreviewIcon(id) {
        const icons = { bedDouble: '🛏', kitchenStove: '🍳', table: '🍽', chair: '🪑', loungeSofa: '🛋', toilet: '🚽', bathtub: '🛁', shower: '🚿' };
        return icons[id] || '🪑';
    }
    
    updateRoomsUI() {
        const container = document.getElementById('rooms-list');
        if (!container) return;
        const roomsArray = Object.values(this.rooms);
        container.innerHTML = roomsArray.map(room => `
            <div class="room-item ${this.currentRoomId === room.id ? 'active' : ''}" data-room-id="${room.id}">
                <span>${room.name}</span>
                <button class="room-select-btn">📂</button>
            </div>
        `).join('');
        
        container.querySelectorAll('.room-select-btn').forEach((btn, i) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const room = roomsArray[i];
                this.currentRoomId = room.id;
                this.loadCurrentRoom();
                this.updateRoomsUI();
            });
        });
    }
    
    updateBackgroundSelect() {
        const bgSelect = document.getElementById('bg-select');
        const room = this.rooms[this.currentRoomId];
        if (bgSelect && room) bgSelect.value = room.background || 'bg_default';
    }
    
    changeBackground(bgKey) {
        const room = this.rooms[this.currentRoomId];
        if (room) {
            room.background = bgKey;
            this.setBackground(bgKey);
            this.saveCurrentRoomToDB();
        }
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
        
        document.getElementById('new-room-btn')?.addEventListener('click', () => this.createNewRoom());
        
        const bgSelect = document.getElementById('bg-select');
        if (bgSelect) {
            bgSelect.innerHTML = ['default', 'bedroom', 'kitchen', 'bathroom', 'livingroom']
                .map(bg => `<option value="bg_${bg}">${bg}</option>`).join('');
            bgSelect.onchange = (e) => this.changeBackground(e.target.value);
        }
        
        document.getElementById('snap-toggle')?.addEventListener('click', () => this.toggleSnap());
        document.getElementById('delete-selected')?.addEventListener('click', () => this.deleteSelected());
        document.getElementById('lock-selected')?.addEventListener('click', () => this.lockSelected());
        document.getElementById('unlock-selected')?.addEventListener('click', () => this.unlockSelected());
    }
    
    async createNewRoom() {
        const name = prompt('Название комнаты:', 'Новая комната');
        if (!name) return;
        try {
            const newRoom = await api.createRoom({ name, background: 'bg_default', items: [] });
            this.rooms[newRoom.id] = { ...newRoom, items: [] };
            this.currentRoomId = newRoom.id;
            this.loadCurrentRoom();
            this.updateRoomsUI();
            this.showMessage(`✅ Комната "${name}" создана`, 'success');
        } catch (error) {
            this.showMessage('❌ Ошибка создания', 'error');
        }
    }
    
    addMobileControls() {
        const controls = [
            { icon: '🗑', action: () => this.deleteSelected(), x: 70 },
            { icon: '🔄', action: () => this.rotateSelected(), x: 140 },
            { icon: '📐', action: () => this.toggleSnap(), x: 210 },
            { icon: '❌', action: () => this.cancelPendingItem(), x: 280 }
        ];
        
        controls.forEach((ctrl, i) => {
            const btn = this.add.text(ctrl.x, 700, ctrl.icon, {
                fontSize: '28px',
                backgroundColor: '#000000aa',
                padding: { x: 8, y: 5 },
                borderRadius: 30
            }).setInteractive().setDepth(1000);
            btn.on('pointerdown', ctrl.action);
        });
    }
    
    // Заглушки для остальных методов (добавьте свои реализации)
    async loadFamilyMembers() {}
    createParentPanel() {}
    setupModalClose() {}
    async refreshTaskMarkers() {}
    updateTaskMarkerForItem() {}
    restoreTaskModal() {}
}

export default EditorScene;