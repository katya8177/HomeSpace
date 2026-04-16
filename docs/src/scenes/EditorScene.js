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
        this.load.on('complete', () => {
            console.log('✅ Модели загружены');
        });
    }

    async create() {
        const userStr = localStorage.getItem('homespace_currentUser');
        if (userStr) {
            try {
                this.currentUser = JSON.parse(userStr);
                console.log('✅ Пользователь загружен:', this.currentUser.name, 'роль:', this.currentUser.role);
            } catch(e) {
                console.error('Ошибка парсинга:', e);
            }
        }
        
        if (!this.currentUser) {
            console.error('❌ Пользователь не авторизован');
            window.location.href = '/';
            return;
        }
        
        this.parentMode = this.currentUser.role === 'parent';
        
        if (!this.cameras?.main) {
            this.time.delayedCall(100, () => this.create());
            return;
        }
        
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
        
        console.log('✅ EditorScene ready');
    }
    
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
                
                if (!this.currentRoomId || !this.rooms[this.currentRoomId]) {
                    this.currentRoomId = roomsFromDB[0].id;
                    this.currentRoomName = roomsFromDB[0].name;
                }
            } else {
                await this.createDefaultRoom();
            }
        } catch (error) {
            console.error('Ошибка загрузки комнат из БД:', error);
            await this.createDefaultRoom();
        }
    }

    selectRoom(roomId) {
        const room = this.rooms[roomId];
        if (!room) return;
        
        this.currentRoomId = roomId;
        this.currentRoomName = room.name;
        this.loadCurrentRoom();
        this.updateRoomsUI();
        
        console.log(`🔄 Переключено на комнату: ${room.name}`);
    }
    
    async createDefaultRoom() {
        try {
            const newRoom = await api.createRoom({
                name: 'Моя комната',
                background: 'bg_default',
                items: []
            });
            this.rooms = {};
            this.rooms[newRoom.id] = {
                id: newRoom.id,
                name: newRoom.name,
                background: newRoom.background || 'bg_default',
                items: newRoom.items || []
            };
            this.currentRoomId = newRoom.id;
            this.currentRoomName = newRoom.name;
        } catch (error) {
            console.error('Ошибка создания комнаты по умолчанию:', error);
            this.loadRoomsFromLocalStorage();
        }
    }
    
    loadRoomsFromLocalStorage() {
        const key = `homespace_rooms_user_${this.currentUser.id}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try { 
                this.rooms = JSON.parse(saved); 
                const firstKey = Object.keys(this.rooms)[0];
                if (firstKey) {
                    this.currentRoomId = firstKey;
                    this.currentRoomName = this.rooms[firstKey].name;
                }
            } catch(e) {}
        }
        
        if (Object.keys(this.rooms).length === 0) {
            const defaultId = 'default';
            this.rooms = {
                [defaultId]: { id: defaultId, name: 'Моя комната', background: 'bg_default', items: [] }
            };
            this.currentRoomId = defaultId;
            this.currentRoomName = 'Моя комната';
            this.saveRoomsToLocalStorage();
        }
    }
    
    saveRoomsToLocalStorage() {
        const key = `homespace_rooms_user_${this.currentUser.id}`;
        localStorage.setItem(key, JSON.stringify(this.rooms));
    }
    
async saveCurrentRoomToDB() {
    if (this.readOnlyMode) return;
    if (!this.currentRoomId || this.currentRoomId === 'default') return;
    
    const room = this.rooms[this.currentRoomId];
    if (!room) return;
    
    const items = [];
    this.furnitureGroup.getChildren().forEach(sprite => {
        items.push({
            type: sprite.getData('type'),
            itemInstanceId: sprite.getData('itemInstanceId'), // ← ДОЛЖНО БЫТЬ
            x: sprite.x,
            y: sprite.y,
            direction: sprite.getData('direction') || 'NE',
            scale: sprite.scale,
            depth: sprite.depth,
            locked: sprite.getData('locked') || false
        });
    });
    
    try {
        await api.updateRoom(this.currentRoomId, {
            name: room.name,
            background: room.background || 'bg_default',
            items: items
        });
        room.items = items;
        this.saveRoomsToLocalStorage();
    } catch (error) {
        console.error('Ошибка сохранения комнаты в БД:', error);
        room.items = items;
        this.saveRoomsToLocalStorage();
    }
}
// Проверка и добавление itemInstanceId для всех предметов в комнате при загрузке
async ensureItemInstanceIds() {
    const room = this.rooms[this.currentRoomId];
    if (!room) return;
    
    let needsSave = false;
    
    for (const item of room.items) {
        if (!item.itemInstanceId) {
            item.itemInstanceId = `${item.type}_${Date.now()}_${Math.random()}`;
            needsSave = true;
            console.log(`🆕 Добавлен ID для предмета: ${item.type}`);
        }
    }
    
    if (needsSave) {
        await this.saveCurrentRoomToDB();
        console.log(`✅ Сохранены ID для всех предметов в комнате ${room.name}`);
    }
}
    
loadCurrentRoom() {
    this.clearAllMarkers();
    
    this.furnitureGroup.getChildren().forEach(sprite => sprite.destroy());
    this.furnitureGroup.clear(true, true);
    this.selectedItem = null;
    
    const room = this.rooms[this.currentRoomId];
    if (!room) return;
    
    this.setBackground(room.background);
    
    if (room.items && room.items.length > 0) {
        room.items.forEach(item => {
            const sprite = this.addFurniture(item.type, item.x, item.y, item.direction, item.itemInstanceId);
            if (sprite) {
                if (item.scale) sprite.setScale(item.scale);
                if (item.depth) sprite.setDepth(item.depth);
                if (item.locked) {
                    sprite.setData('locked', true);
                    sprite.setTint(0xff6666);
                }
                setTimeout(() => this.updateTaskMarkerForItem(sprite), 100);
            }
        });
    }
    
    this.updateRoomsUI();
    this.updateBackgroundSelect();
    
    // ДОБАВИТЬ ЭТУ СТРОКУ - автоматически добавит ID всем предметам без ID
    setTimeout(() => this.ensureItemInstanceIds(), 500);
    
    if (this.readOnlyMode) {
        this.showMessage('👁️ Режим просмотра (только чтение)');
        this.showBackButton();
    } else {
        this.hideBackButton();
    }
}
    
    async loadRoomById(roomId, readOnly = false) {
        try {
            const room = await api.getRoomById(roomId);
            if (!room) return;
            
            this.readOnlyMode = readOnly || room.readOnly === true;
            
            this.rooms[room.id] = {
                id: room.id,
                name: room.name,
                background: room.background || 'bg_default',
                items: room.items || []
            };
            this.currentRoomId = room.id;
            this.currentRoomName = room.name;
            
            this.loadCurrentRoom();
            
            setTimeout(async () => {
                await this.refreshTaskMarkers();
            }, 1000);
            
            this.createInstruction();
            
            if (this.readOnlyMode) {
                this.showBackButton();
            } else {
                this.hideBackButton();
            }
        } catch (error) {
            console.error('Ошибка загрузки комнаты по ID:', error);
        }
    }
    
    clearAllMarkers() {
        const sprites = this.furnitureGroup.getChildren();
        console.log(`🗑️ Очистка маркеров для ${sprites.length} предметов`);
        
        for (const sprite of sprites) {
            const marker = sprite.getData('taskMarker');
            const text = sprite.getData('taskText');
            if (marker) {
                marker.destroy();
                sprite.setData('taskMarker', null);
            }
            if (text) {
                text.destroy();
                sprite.setData('taskText', null);
            }
            
            const updater = sprite.getData('markerUpdater');
            if (updater) {
                this.events.off('update', updater);
                sprite.setData('markerUpdater', null);
            }
        }
    }
    
    showBackButton() {
        if (this.backButton) return;
        this.backButton = this.add.text(1000, 30, '← Вернуться к моим комнатам', {
            fontSize: '14px',
            color: '#ffffff',
            backgroundColor: '#000000aa',
            padding: { x: 12, y: 6 },
            borderRadius: 20
        }).setInteractive({ useHandCursor: true }).setDepth(1000);
        
        this.backButton.on('pointerdown', async () => {
            console.log('🔙 Возврат к своим комнатам');
            
            this.clearAllMarkers();
            
            this.viewingChildId = null;
            this.readOnlyMode = false;
            
            if (this.parentPanel) {
                this.parentPanel.style.display = 'block';
            }
            
            await this.loadRoomsFromDB();
            
            if (this.rooms && Object.keys(this.rooms).length > 0) {
                const firstRoomId = Object.keys(this.rooms)[0];
                this.currentRoomId = firstRoomId;
                this.currentRoomName = this.rooms[firstRoomId].name;
                this.loadCurrentRoom();
            }
            
            this.updateRoomsUI();
            this.createInstruction();
            this.hideBackButton();
            
            console.log(`✅ Возврат завершен, комнаты родителя загружены`);
        });
    }
    
    hideBackButton() {
        if (this.backButton) {
            this.backButton.destroy();
            this.backButton = null;
        }
    }
    
    async loadFamilyMembers() {
        try {
            this.familyMembers = await api.getFamilyMembers();
            this.children = this.familyMembers.filter(m => m.role === 'child');
            console.log('👶 Дети в семье:', this.children.length);
        } catch (error) {
            console.error('Ошибка загрузки членов семьи:', error);
            this.children = [];
        }
    }
    
    createParentPanel() {
        const panelDiv = document.createElement('div');
        panelDiv.id = 'parent-panel';
        panelDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 280px;
            background: rgba(15, 15, 26, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 18px;
            border: 1px solid rgba(78, 204, 163, 0.55);
            color: white;
            z-index: 1000;
            overflow: hidden;
            transition: all 0.3s ease;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        
        panelDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.1);" id="parent-panel-header">
                <span style="font-weight: bold;">👶 Комнаты детей</span>
                <span id="parent-panel-toggle" style="font-size: 18px;">▼</span>
            </div>
            <div id="parent-panel-content" style="padding: 12px; max-height: 500px; overflow-y: auto;">
                <div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.6);">Загрузка...</div>
            </div>
        `;
        
        document.body.appendChild(panelDiv);
        this.parentPanel = panelDiv;
        
        const header = document.getElementById('parent-panel-header');
        const content = document.getElementById('parent-panel-content');
        const toggle = document.getElementById('parent-panel-toggle');
        
        header.addEventListener('click', () => {
            this.parentPanelCollapsed = !this.parentPanelCollapsed;
            if (this.parentPanelCollapsed) {
                content.style.display = 'none';
                toggle.textContent = '▶';
                panelDiv.style.width = 'auto';
            } else {
                content.style.display = 'block';
                toggle.textContent = '▼';
                panelDiv.style.width = '280px';
            }
        });
        
        this.updateParentPanel();
    }
    
async updateParentPanel() {
    const content = document.getElementById('parent-panel-content');
    if (!content) return;
    
    if (!this.children || this.children.length === 0) {
        content.innerHTML = '<div style="text-align: center; padding: 20px;">❌ Нет детей в семье</div>';
        return;
    }
    
    let html = '';
    
    for (const child of this.children) {
        const childRooms = await api.getChildRooms(child.id);
        
        html += `
            <div style="margin-bottom: 15px;">
                <div style="font-weight: bold; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                    <span>${child.avatar || '👶'}</span>
                    <span>${child.name}</span>
                    <span style="font-size: 10px; color: #888;">ID: ${child.id.substring(0, 8)}</span>
                </div>
                <div style="margin-left: 15px;">
        `;
        
        if (childRooms && childRooms.length > 0) {
            for (const room of childRooms) {
                html += `
                    <div class="child-room-item" data-room-id="${room.id}" data-child-id="${child.id}" style="
                        padding: 6px 10px;
                        margin: 4px 0;
                        background: rgba(78, 204, 163, 0.1);
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                        font-size: 12px;
                    ">
                        🏠 ${room.name}
                    </div>
                `;
            }
        } else {
            html += `<div style="color: rgba(255,255,255,0.4); font-size: 12px; padding: 4px 0;">Нет комнат</div>`;
        }
        
        html += `</div></div>`;
    }
    
    content.innerHTML = html;
    
    document.querySelectorAll('.child-room-item').forEach(el => {
        el.addEventListener('click', async (e) => {
            e.stopPropagation();
            const roomId = el.dataset.roomId;
            const childId = el.dataset.childId;  // ← Берем ID ребенка
            if (roomId && childId) {
                console.log('👶 Открываем комнату ребенка:', roomId);
                console.log('👶 ID ребенка:', childId);
                this.viewingChildId = childId;  // ← Сохраняем ID РЕБЕНКА, а не комнаты!
                await this.loadRoomById(roomId, true);
                
                if (this.parentPanel) {
                    this.parentPanel.style.display = 'none';
                    console.log('👪 Панель родителей скрыта');
                }
            }
        });
    });
}
    
    setBackground(bgKey = null) {
        if (this.background) this.background.destroy();
        
        const room = this.rooms[this.currentRoomId];
        const bg = bgKey || room?.background || 'bg_default';
        
        if (this.textures.exists(bg)) {
            this.background = this.add.image(640, 400, bg);
            this.background.setDepth(-10);
        } else {
            const colorMap = {
                bg_default: '#1a1a2e',
                bg_bedroom: '#2c1735',
                bg_kitchen: '#3d2b18',
                bg_bathroom: '#1a3847',
                bg_livingroom: '#21322a'
            };
            const color = colorMap[bg] || '#1a1a2e';
            this.cameras.main.setBackgroundColor(color);
        }
        this.updateBackgroundSelect();
    }
    
    changeBackground(bgKey) {
        if (this.readOnlyMode) {
            this.showMessage('❌ Режим только просмотра');
            return;
        }
        
        const room = this.rooms[this.currentRoomId];
        if (room) {
            room.background = bgKey;
            this.setBackground(bgKey);
            this.saveCurrentRoomToDB();
            this.showMessage('Фон изменен');
        }
    }
    
    updateBackgroundSelect() {
        const bgSelect = document.getElementById('bg-select');
        const room = this.rooms[this.currentRoomId];
        if (bgSelect && room) {
            bgSelect.value = room.background || 'bg_default';
        }
    }
    
    cycleBackground() {
        if (this.readOnlyMode) return;
        
        const backgrounds = ['bg_default', 'bg_bedroom', 'bg_kitchen', 'bg_bathroom', 'bg_livingroom'];
        const room = this.rooms[this.currentRoomId];
        const currentBg = room?.background || 'bg_default';
        const currentIndex = backgrounds.indexOf(currentBg);
        const nextIndex = (currentIndex + 1) % backgrounds.length;
        const nextBg = backgrounds[nextIndex];
        this.changeBackground(nextBg);
    }
    
    uploadBackground() {
        if (this.readOnlyMode) {
            this.showMessage('❌ Режим только просмотра');
            return;
        }
        
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
                        this.changeBackground(bgKey);
                        this.showMessage('✅ Свой фон загружен');
                    });
                    this.load.start();
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
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
        this.gridGraphics.setVisible(this.snapToGrid);
    }
    
    toggleSnap(forceValue) {
        const shouldEnable = typeof forceValue === 'boolean' ? forceValue : !this.snapToGrid;
        this.snapToGrid = shouldEnable;
        if (this.gridGraphics) {
            this.gridGraphics.setVisible(this.snapToGrid);
        }
        const snapBtn = document.getElementById('snap-toggle');
        if (snapBtn) {
            snapBtn.textContent = this.snapToGrid ? '📐 Сетка: вкл' : '📐 Сетка: выкл';
        }
        this.showMessage(this.snapToGrid ? 'Сетка включена (G)' : 'Сетка выключена (G)');
    }
    
    setupInput() {
        let clickTimer = null;
        let pendingItem = null;
        
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
        
        this.input.on('gameobjectdown', (pointer, obj) => {
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
                console.log('🖱️ Двойной клик - открываем задание');
                this.openTaskForItem(obj);
                return;
            }
            
            pendingItem = obj;
            clickTimer = setTimeout(() => {
                if (pendingItem && !this.readOnlyMode) {
                    if (pointer.event?.ctrlKey || (this.isMobile && pointer.event?.touches?.length === 2)) {
                        this.cycleDepth(pendingItem);
                    } else {
                        this.selectItem(pendingItem);
                    }
                }
                clickTimer = null;
                pendingItem = null;
            }, 200);
        });
                
        this.input.on('pointerdown', (pointer) => {
            if (this.readOnlyMode) return;
            const hits = this.input.hitTestPointer(pointer);
            if (hits.length === 0 && this.selectedItem) {
                if (this.selectedItem.clearTint && typeof this.selectedItem.clearTint === 'function') {
                    this.selectedItem.clearTint();
                }
                this.selectedItem = null;
            }
        });
        
        if (!this.isMobile) {
            this.input.keyboard.on('keydown-DELETE', () => this.deleteSelected());
            this.input.keyboard.on('keydown-BACKSPACE', () => this.deleteSelected());
            this.input.keyboard.on('keydown-G', () => this.toggleSnap());
            this.input.keyboard.on('keydown-Q', () => this.rotateDirection(-1));
            this.input.keyboard.on('keydown-E', () => this.rotateDirection(1));
            this.input.keyboard.on('keydown-ESC', () => this.exitPlacementMode());
            this.input.keyboard.on('keydown-PAGE_UP', () => this.bringToFront());
            this.input.keyboard.on('keydown-PAGE_DOWN', () => this.sendToBack());
            this.input.keyboard.on('keydown-L', () => this.lockSelected());
            this.input.keyboard.on('keydown-U', () => this.unlockSelected());
        }
        
        this.input.on('wheel', (pointer, obj, deltaX, deltaY) => {
            if (this.readOnlyMode) return;
            if (this.selectedItem && !this.isLocked(this.selectedItem)) {
                const newScale = Math.max(0.3, Math.min(2, this.selectedItem.scale - deltaY / 500));
                this.selectedItem.setScale(newScale);
                this.saveCurrentRoomToDB();
                this.showMessage(`Масштаб: ${newScale.toFixed(1)}x`);
            } else if (this.selectedItem && this.isLocked(this.selectedItem)) {
                this.showMessage('🔒 Предмет закреплен, сначала разблокируйте (U)');
            }
        });
    }
    
async openTaskForItem(sprite) {
    if (this.currentUser?.role === 'child') {
        this.showMessage('❌ Детям нельзя создавать задания');
        return;
    }
    
    if (this.currentUser?.role === 'parent') {
        if (!this.viewingChildId) {
            this.showMessage('❌ Вы можете создавать задания только в комнатах детей. Откройте комнату ребенка через панель справа');
            return;
        }
    }
    
    const itemType = sprite.getData('type');
    const itemInstanceId = sprite.getData('itemInstanceId');
    const itemName = sprite.getData('name');
    
    if (!itemType) {
        this.showMessage('Не удалось определить предмет');
        return;
    }
    
    console.log('📝 Открытие модального окна для предмета:', itemType, itemInstanceId);
    console.log('👶 viewingChildId (ID ребенка):', this.viewingChildId);
    
    let assignedTo = null;
    let assignedToName = 'Не назначено';
    
    // viewingChildId теперь содержит ID ребенка!
    if (this.currentUser?.role === 'parent' && this.viewingChildId) {
        const child = this.children.find(c => c.id === this.viewingChildId);
        if (child) {
            assignedTo = child.id;
            assignedToName = child.name;
            console.log(`🎯 Задание будет назначено ребенку: ${child.name} (${child.id})`);
        }
    } else if (this.currentUser?.role === 'user') {
        assignedTo = this.currentUser.id;
        assignedToName = this.currentUser.name;
    }
    
    this.showTaskModal(itemType, itemInstanceId, itemName, assignedTo, assignedToName);
}
    
showTaskModal(itemKey, itemInstanceId, itemName, presetAssignedTo, presetAssignedToName) {
    const modal = document.getElementById('task-modal-editor');
    if (!modal) {
        console.error('❌ Модальное окно не найдено');
        return;
    }
    
    console.log(`🎯 showTaskModal: получили presetAssignedTo=${presetAssignedTo}, presetAssignedToName=${presetAssignedToName}`);
    
    const titleInput = document.getElementById('task-title-editor');
    const descInput = document.getElementById('task-desc-editor');
    const bonusInput = document.getElementById('task-bonus-editor');
    const container = document.getElementById('task-assigned-container');
    
    titleInput.value = `Задание для ${itemName}`;
    descInput.value = '';
    bonusInput.value = '10';
    
    // ИСПОЛЬЗУЕМ presetAssignedTo КАК ЕСТЬ
    let forcedAssignedTo = presetAssignedTo;
    let forcedAssignedToName = presetAssignedToName;
    
    console.log(`🎯 forcedAssignedTo=${forcedAssignedTo}, forcedAssignedToName=${forcedAssignedToName}`);
    
    let selectHtml = '';
    if (forcedAssignedTo) {
        selectHtml = `<input type="hidden" id="task-assigned-editor" value="${forcedAssignedTo}">
                      <div style="background: rgba(78,204,163,0.2); padding: 12px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
                          👤 <strong>Задание будет назначено: ${forcedAssignedToName}</strong>
                      </div>`;
    } else {
        selectHtml = '<label style="color:white; display:block; margin-bottom:5px;">👤 Назначить:</label><select id="task-assigned-editor" style="width:100%; padding:12px; background:rgba(44,62,80,0.8); border:1px solid rgba(78,204,163,0.3); border-radius:12px; color:white;">';
        selectHtml += `<option value="">— Не назначено —</option>`;
        if (this.children && this.children.length > 0) {
            for (const child of this.children) {
                selectHtml += `<option value="${child.id}">👶 ${child.name}</option>`;
            }
        }
        selectHtml += '</select>';
    }
    container.innerHTML = selectHtml;
    
    modal.classList.add('active');
    
    const saveBtn = document.getElementById('task-save-editor');
    const cancelBtn = document.getElementById('task-cancel-editor');
    const bonusMinus = document.getElementById('bonus-minus-editor');
    const bonusPlus = document.getElementById('bonus-plus-editor');
    
    const newSaveBtn = saveBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newBonusMinus = bonusMinus.cloneNode(true);
    const newBonusPlus = bonusPlus.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    bonusMinus.parentNode.replaceChild(newBonusMinus, bonusMinus);
    bonusPlus.parentNode.replaceChild(newBonusPlus, bonusPlus);
    
    newBonusMinus.onclick = () => {
        let val = parseInt(bonusInput.value) || 10;
        if (val > 1) bonusInput.value = val - 1;
    };
    newBonusPlus.onclick = () => {
        let val = parseInt(bonusInput.value) || 10;
        bonusInput.value = val + 1;
    };
    
    newCancelBtn.onclick = () => {
        modal.classList.remove('active');
    };
    
    newSaveBtn.onclick = async () => {
        const title = titleInput.value.trim();
        if (!title) {
            alert('Введите название задания');
            return;
        }
        
        // Берем assignedTo из forcedAssignedTo (который мы установили из presetAssignedTo)
        let assignedTo = forcedAssignedTo;
        
        // Если нет принудительного назначения - берем из select
        if (!assignedTo) {
            const assignedToSelect = document.getElementById('task-assigned-editor');
            assignedTo = assignedToSelect ? assignedToSelect.value || null : null;
        }
        
        const bonus = parseInt(bonusInput.value) || 10;
        const description = descInput.value;
        
        console.log(`📤 СОЗДАНИЕ ЗАДАНИЯ: предмет=${itemKey}, назначено=${assignedTo}, instanceId=${itemInstanceId}`);
        
        try {
            const taskData = {
                title: title,
                description: description,
                bonus: bonus,
                assignedTo: assignedTo,
                itemKey: itemKey,
                itemInstanceId: itemInstanceId
            };
            
            const result = await api.createTask(taskData);
            console.log('✅ Задание создано:', result);
            
            this.showMessage(`✅ Задание "${title}" создано!`);
            modal.classList.remove('active');
            
            setTimeout(() => this.refreshTaskMarkers(), 500);
            
        } catch (error) {
            console.error('Ошибка создания задания:', error);
            alert('Не удалось создать задание: ' + (error.message || 'Ошибка сервера'));
        }
    };
}
    
    async refreshTaskMarkers() {
        this.clearAllMarkers();
        
        const sprites = this.furnitureGroup.getChildren();
        console.log(`🔄 Обновление маркеров для ${sprites.length} предметов`);
        
        for (const sprite of sprites) {
            await this.updateTaskMarkerForItem(sprite);
        }
    }
    
async updateTaskMarkerForItem(sprite) {
    const itemType = sprite.getData('type');
    const itemInstanceId = sprite.getData('itemInstanceId');
    if (!itemType) return;
    
    try {
        const tasks = await api.getTasks({ itemKey: itemType });
        let activeTasks = tasks.filter(t => t.status !== 'completed');
        
        let visibleTasks = [];
        
        if (this.currentUser?.role === 'child') {
            // Ребенок видит только задания, назначенные ему
            visibleTasks = activeTasks.filter(t => 
                t.assigned_to === this.currentUser.id && 
                t.item_instance_id === itemInstanceId
            );
            console.log(`👶 Ребенок: заданий для этого предмета ${visibleTasks.length}`);
        } 
        else if (this.currentUser?.role === 'parent' && this.viewingChildId) {
            // Родитель в комнате ребенка - видит задания, назначенные этому ребенку
            visibleTasks = activeTasks.filter(t => 
                t.assigned_to === this.viewingChildId && 
                t.item_instance_id === itemInstanceId
            );
            console.log(`👨‍👧 Родитель в комнате ребенка: заданий ${visibleTasks.length}, ID ребенка=${this.viewingChildId}, itemInstanceId=${itemInstanceId}`);
        }
        else if (this.currentUser?.role === 'user') {
            // Обычный пользователь - видит задания, назначенные ему
            visibleTasks = activeTasks.filter(t => 
                t.assigned_to === this.currentUser.id && 
                t.item_instance_id === itemInstanceId
            );
            console.log(`👤 Обычный пользователь: заданий для этого предмета ${visibleTasks.length}`);
        }
        else {
            visibleTasks = [];
        }
        
        // Очистка старых маркеров
        const oldMarker = sprite.getData('taskMarker');
        const oldText = sprite.getData('taskText');
        if (oldMarker) oldMarker.destroy();
        if (oldText) oldText.destroy();
        
        const oldUpdater = sprite.getData('markerUpdater');
        if (oldUpdater) {
            this.events.off('update', oldUpdater);
            sprite.setData('markerUpdater', null);
        }
        
        if (visibleTasks && visibleTasks.length > 0) {
            const markerY = sprite.y - 35;
            
            const marker = this.add.circle(sprite.x, markerY, 16, 0xe94560)
                .setStrokeStyle(2, 0xffffff)
                .setDepth(100);
            
            const text = this.add.text(sprite.x, markerY, visibleTasks.length.toString(), {
                fontSize: '12px',
                fill: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(101);
            
            marker.setInteractive({ useHandCursor: true });
            text.setInteractive({ useHandCursor: true });
            
            marker.on('pointerdown', () => {
                this.showTaskModalForItem(sprite, visibleTasks);
            });
            text.on('pointerdown', () => {
                this.showTaskModalForItem(sprite, visibleTasks);
            });
            
            sprite.setData('taskMarker', marker);
            sprite.setData('taskText', text);
            sprite.setData('tasks', visibleTasks);
            
            const updater = () => {
                if (!sprite.scene) return;
                const m = sprite.getData('taskMarker');
                const t = sprite.getData('taskText');
                if (m && t && sprite.active) {
                    m.setPosition(sprite.x, sprite.y - 35);
                    t.setPosition(sprite.x, sprite.y - 35);
                }
            };
            
            sprite.setData('markerUpdater', updater);
            this.events.on('update', updater);
            
            console.log(`✅ Маркер создан для ${itemType}, заданий: ${visibleTasks.length}`);
        } else {
            console.log(`❌ Нет маркеров для ${itemType}`);
        }
    } catch (error) {
        console.error('Ошибка загрузки заданий для предмета', itemType, error);
    }
}
    
showTaskModalForItem(sprite, tasks) {
    if (!tasks || tasks.length === 0) return;
    
    const modal = document.getElementById('task-modal-editor');
    if (!modal) {
        console.error('❌ Модальное окно не найдено');
        alert(`📋 Задания для "${sprite.getData('name')}":\n\n${this.formatTasksList(tasks)}`);
        return;
    }
    
    const itemName = sprite.getData('name') || 'предмета';
    
    let tasksHtml = '<div class="tasks-list-modal" style="max-height: 400px; overflow-y: auto; margin: 15px 0;">';
    tasks.forEach((task, i) => {
        const statusIcon = task.status === 'completed' ? '✅' : '⏳';
        tasksHtml += `
            <div class="task-item-modal" style="background: rgba(15, 25, 35, 0.6); border-radius: 14px; padding: 14px; margin-bottom: 10px; border-left: 3px solid ${task.status === 'completed' ? '#4ecca3' : '#e94560'};">
                <div style="font-weight: 700; color: #ffffff; display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>${statusIcon} ${this.escapeHtml(task.title)}</span>
                    <span style="color: #ffd700;">💰 ${task.bonus}</span>
                </div>
                ${task.description ? `<div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 6px;">📝 ${this.escapeHtml(task.description)}</div>` : ''}
                <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 8px;">
                    👤 ${task.assigned_to_name || 'Не назначено'} | ✏️ от ${task.created_by_name}
                </div>
                <div style="font-size: 11px; margin-top: 3px;">
                    ${task.status === 'completed' ? '<span style="color:#4ecca3;">✅ Выполнено</span>' : '<span style="color:#e94560;">⏳ В ожидании</span>'}
                </div>
            </div>
        `;
    });
    tasksHtml += '</div>';
    
    if (this.currentUser?.role !== 'child') {
        tasksHtml += '<div style="margin-top: 15px; padding: 10px; background: rgba(78,204,163,0.1); border-radius: 8px; font-size: 12px; text-align: center; color: #aaa;">💡 Для выполнения заданий откройте раздел "Задания" в меню</div>';
    }
    
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.innerHTML = `
            <h3 style="color: #4ecca3; margin-bottom: 20px; font-size: 24px; text-align: center;">📋 Задания для "${this.escapeHtml(itemName)}"</h3>
            ${tasksHtml}
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                <button id="task-modal-close" style="padding: 10px 25px; border-radius: 30px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); cursor: pointer;">Закрыть</button>
            </div>
        `;
        
        const closeBtn = document.getElementById('task-modal-close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.classList.remove('active');
                this.restoreTaskModal();
            };
        }
    }
    
    modal.classList.add('active');
}

// Добавьте вспомогательный метод для экранирования HTML
escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
    
    restoreTaskModal() {
        const modal = document.getElementById('task-modal-editor');
        if (!modal) return;
        
        modal.querySelector('.modal-content').innerHTML = `
            <h3>📝 Создать задание</h3>
            <input type="text" id="task-title-editor" placeholder="Название задания" autocomplete="off">
            <textarea id="task-desc-editor" placeholder="Описание (необязательно)"></textarea>
            <div class="bonus-control">
                <span>💰 Бонус:</span>
                <button class="bonus-btn" id="bonus-minus-editor">-</button>
                <input type="number" id="task-bonus-editor" value="10" min="1" max="100">
                <button class="bonus-btn" id="bonus-plus-editor">+</button>
            </div>
            <div id="task-assigned-container"></div>
            <div class="modal-buttons">
                <button class="modal-cancel" id="task-cancel-editor">Отмена</button>
                <button class="modal-save" id="task-save-editor">Создать</button>
            </div>
        `;
    }
    
    formatTasksList(tasks) {
        let message = '';
        tasks.forEach((task, i) => {
            const statusIcon = task.status === 'completed' ? '✅' : '⏳';
            message += `${statusIcon} ${i+1}. ${task.title}\n`;
            message += `   💰 Бонус: ${task.bonus}\n`;
            if (task.description) message += `   📝 ${task.description}\n`;
            message += `   👤 Назначено: ${task.assigned_to_name || 'Не назначено'}\n`;
            message += `   ✏️ Создал: ${task.created_by_name}\n\n`;
        });
        return message;
    }
    
    setupModalClose() {
        const modal = document.getElementById('task-modal-editor');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        }
    }
    
cycleDepth(item) {
    if (this.readOnlyMode) return;
    if (!item || typeof item.setDepth !== 'function') return;
    if (this.isLocked(item)) {
        this.showMessage('🔒 Предмет закреплен, сначала разблокируйте');
        return;
    }
    let newDepth = item.depth + 10;
    if (newDepth > 100) newDepth = 1;
    item.setDepth(newDepth);
    this.showMessage(`Слой: ${newDepth}`);
    this.saveCurrentRoomToDB();
}
    
bringToFront() {
    if (this.readOnlyMode) return;
    if (this.selectedItem && !this.isLocked(this.selectedItem) && typeof this.selectedItem.setDepth === 'function') {
        this.selectedItem.setDepth(100);
        this.showMessage('На передний план');
        this.saveCurrentRoomToDB();
    } else if (this.selectedItem && this.isLocked(this.selectedItem)) {
        this.showMessage('🔒 Предмет закреплен, сначала разблокируйте');
    }
}
    
sendToBack() {
    if (this.readOnlyMode) return;
    if (this.selectedItem && !this.isLocked(this.selectedItem) && typeof this.selectedItem.setDepth === 'function') {
        this.selectedItem.setDepth(1);
        this.showMessage('На задний план');
        this.saveCurrentRoomToDB();
    } else if (this.selectedItem && this.isLocked(this.selectedItem)) {
        this.showMessage('🔒 Предмет закреплен, сначала разблокируйте');
    }
}
    
selectItem(item) {
    if (this.readOnlyMode) return;
    
    // Проверяем, что item - это спрайт (имеет метод setTint)
    if (!item || typeof item.setTint !== 'function') {
        console.warn('selectItem: item не является спрайтом', item);
        return;
    }
    
    if (this.selectedItem && this.selectedItem !== item) {
        // Очищаем tint у предыдущего выбранного предмета
        if (this.selectedItem.clearTint && typeof this.selectedItem.clearTint === 'function') {
            this.selectedItem.clearTint();
        }
    }
    this.selectedItem = item;
    
    if (this.isLocked(item)) {
        item.setTint(0xff6666);
        this.showMessage(`🔒 ${item.getData('name') || 'Предмет'} (закреплен)`);
    } else {
        item.setTint(0xffaa00);
        this.showMessage(`📌 ${item.getData('name') || 'Предмет'} выбран`);
    }
}
    
deleteSelected() {
    if (this.readOnlyMode) return;
    if (this.selectedItem && !this.isLocked(this.selectedItem) && typeof this.selectedItem.destroy === 'function') {
        const marker = this.selectedItem.getData('taskMarker');
        const text = this.selectedItem.getData('taskText');
        if (marker) marker.destroy();
        if (text) text.destroy();
        this.furnitureGroup.remove(this.selectedItem, true, true);
        this.selectedItem = null;
        this.saveCurrentRoomToDB();
        this.showMessage('🗑 Предмет удален');
    } else if (this.selectedItem && this.isLocked(this.selectedItem)) {
        this.showMessage('🔒 Предмет закреплен, сначала разблокируйте (U)');
    } else {
        this.showMessage('Сначала выберите предмет');
    }
}
    
    lockSelected() {
        if (this.readOnlyMode) return;
        if (this.selectedItem) {
            this.selectedItem.setData('locked', true);
            this.selectedItem.setTint(0xff6666);
            this.showMessage(`🔒 ${this.selectedItem.getData('name') || 'Предмет'} закреплен`);
            this.saveCurrentRoomToDB();
        } else {
            this.showMessage('Сначала выберите предмет');
        }
    }
    
    unlockSelected() {
        if (this.readOnlyMode) return;
        if (this.selectedItem) {
            this.selectedItem.setData('locked', false);
            this.selectedItem.clearTint();
            this.selectedItem.setTint(0xffaa00);
            this.showMessage(`🔓 ${this.selectedItem.getData('name') || 'Предмет'} разблокирован`);
            this.saveCurrentRoomToDB();
        } else {
            this.showMessage('Сначала выберите предмет');
        }
    }
    
    isLocked(item) {
        return item.getData('locked') === true;
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
    
addFurniture(furnitureId, x, y, direction = this.currentDirection, existingInstanceId = null) {
    const item = this.furnitureCatalog.find(f => f.id === furnitureId);
    if (!item) return null;
    
    const chosenDirection = item.rotations.includes(direction) ? direction : item.rotations[0];
    const textureKey = `${furnitureId}_${chosenDirection}`;
    
    if (!this.textures.exists(textureKey)) {
        console.warn(`⚠️ Текстура не найдена: ${textureKey}`);
        return null;
    }
    
    const sprite = this.add.sprite(x, y, textureKey);
    
    // ВАЖНО: используем existingInstanceId, если он передан!
    const uniqueItemId = existingInstanceId || `${furnitureId}_${Date.now()}_${Math.random()}`;
    
    console.log(`🆔 Создан предмет: ${furnitureId}, instanceId: ${uniqueItemId}, existingInstanceId: ${existingInstanceId}`);
    
    sprite.setData('type', furnitureId);
    sprite.setData('itemInstanceId', uniqueItemId);
    sprite.setData('direction', chosenDirection);
    sprite.setData('name', item.name);
    sprite.setData('locked', false);
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
    this.saveCurrentRoomToDB();
    this.updateTaskMarkerForItem(sprite);
    
    return sprite;
}
    createInstruction() {
        if (this.instructionText) this.instructionText.destroy();
        
        let text;
        if (this.readOnlyMode) {
            text = '👁️ Режим просмотра (только чтение) | Двойной клик на предмет → создать задание';
        } else if (this.currentUser?.role === 'parent' && !this.viewingChildId) {
            text = '👨‍👩‍👧 Режим родителя | Откройте комнату ребенка через панель справа, чтобы создавать задания';
        } else {
            text = this.isMobile 
                ? '🖱 Нажми на предмет → на поле | 🗑 Delete | 🔄 Поворот | Сетка | 🏠 Фон | 🔒/🔓 Закрепить'
                : '🖱 Выберите предмет → клик на поле | 🗑 Delete | 🔄 Q/E поворот | 🖱 Колёсико масштаб | 🔒 L закрепить | 🔓 U разблокировать | 📌 Ctrl+клик слой | 📄 PageUp/PageDown | G сетка';
        }
        
        this.instructionText = this.add.text(640, this.isMobile ? 720 : 750, text, {
            fontSize: this.isMobile ? '9px' : '11px',
            color: '#ffffff',
            backgroundColor: '#000000aa',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setDepth(1000);
    }
    
    enterPlacementMode(furnitureId) {
        if (this.readOnlyMode) {
            this.showMessage('❌ Режим только просмотра, нельзя добавлять предметы');
            return;
        }
        
        this.placementMode = true;
        this.selectedFurnitureId = furnitureId;
        
        const item = this.furnitureCatalog.find(f => f.id === furnitureId);
        const canRotate = item && item.hasDirections;
        
        if (this.instructionText) this.instructionText.destroy();
        
        let instruction;
        let fontSize;
        
        if (this.isMobile) {
            const rotateText = canRotate ? ' | 🔄 Поворот' : '';
            instruction = `📌 ${furnitureId} | ESC выход${rotateText} | 🗑 Delete`;
            fontSize = '9px';
        } else {
            const rotateText = canRotate ? 'Q/E' : '';
            if (canRotate) {
                instruction = `📌 Размещение: ${furnitureId} | ESC | ${rotateText} поворот | 🗑 Del | 🖱 Масштаб | 🔒/🔓 L/U | 📌 Ctrl+клик | 📄 PgUp/PgDn | G сетка`;
            } else {
                instruction = `📌 Размещение: ${furnitureId} | ESC | 🗑 Del | 🖱 Масштаб | 🔒/🔓 L/U | 📌 Ctrl+клик | 📄 PgUp/PgDn | G сетка`;
            }
            fontSize = '10px';
        }
            
        this.instructionText = this.add.text(640, this.isMobile ? 720 : 750, instruction, 
            {
                fontSize: fontSize,
                color: '#ffd700',
                backgroundColor: '#000000aa',
                padding: { x: 10, y: 5 },
                wordWrap: { width: 1200 }
            }
        ).setOrigin(0.5).setDepth(1000);
        
        const clickHandler = (pointer) => {
            if (this.placementMode && this.selectedFurnitureId && !this.readOnlyMode) {
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
        if (this.readOnlyMode) return;
        
        const currentIndex = this.directions.indexOf(this.currentDirection);
        const newIndex = (currentIndex + delta + this.directions.length) % this.directions.length;
        const newDirection = this.directions[newIndex];
        this.currentDirection = newDirection;
        
        if (this.selectedItem && !this.isLocked(this.selectedItem)) {
            const furnitureId = this.selectedItem.getData('type');
            const item = this.furnitureCatalog.find(f => f.id === furnitureId);
            if (item && item.rotations.includes(newDirection)) {
                const textureKey = `${furnitureId}_${newDirection}`;
                if (this.textures.exists(textureKey)) {
                    this.selectedItem.setTexture(textureKey);
                    this.selectedItem.setData('direction', newDirection);
                    this.saveCurrentRoomToDB();
                }
            }
        }
        
        this.showMessage(`Поворот: ${this.currentDirection} (${delta > 0 ? 'E' : 'Q'})`);
    }
    
    updateFurnitureUI() {
        const container = document.getElementById('furniture-list');
        if (!container) {
            console.error('❌ Контейнер furniture-list не найден');
            return;
        }
        
        console.log('🪑 Обновление UI, категория:', this.currentCategory, 'поиск:', this.searchQuery);
        console.log('📦 Всего предметов:', this.furnitureCatalog.length);
        
        let filtered = [...this.furnitureCatalog];
        
        if (this.currentCategory !== 'all') {
            filtered = filtered.filter(f => f.category === this.currentCategory);
            console.log('📁 После фильтра по категории:', filtered.length);
        }
        
        if (this.searchQuery && this.searchQuery.trim() !== '') {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(f => f.name.toLowerCase().includes(query));
            console.log('🔍 После поиска "', query, '":', filtered.length);
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
                console.log('🖱️ Выбран предмет:', id);
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
        
        const roomsArray = Object.values(this.rooms);
        if (roomsArray.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:20px;">📭 Нет комнат</div>';
            return;
        }
        
        container.innerHTML = roomsArray.map(room => `
            <div class="room-item ${this.currentRoomId === room.id ? 'active' : ''}" data-room-id="${room.id}">
                <span>${room.name}</span>
                <div>
                    <button class="room-select-btn" data-room-id="${room.id}">📂</button>
                    ${room.id !== 'default' ? `<button class="room-delete-btn" data-room-id="${room.id}">🗑</button>` : ''}
                </div>
            </div>
        `).join('');
        
        container.querySelectorAll('.room-select-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const roomId = btn.dataset.roomId;
                const room = this.rooms[roomId];
                if (room) {
                    this.currentRoomId = roomId;
                    this.currentRoomName = room.name;
                    this.readOnlyMode = false;
                    this.loadCurrentRoom();
                    if (this.parentPanel) {
                        this.parentPanel.style.display = 'block';
                    }
                    this.updateRoomsUI();
                }
            });
        });
        
        container.querySelectorAll('.room-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const roomId = btn.dataset.roomId;
                await this.deleteRoom(roomId);
            });
        });
        
        container.querySelectorAll('.room-item').forEach(item => {
            item.addEventListener('click', async () => {
                const roomId = item.dataset.roomId;
                const room = this.rooms[roomId];
                if (room) {
                    this.currentRoomId = roomId;
                    this.currentRoomName = room.name;
                    this.readOnlyMode = false;
                    this.loadCurrentRoom();
                    if (this.parentPanel) {
                        this.parentPanel.style.display = 'block';
                    }
                    this.updateRoomsUI();
                }
            });
        });
    }
    
    async createNewRoom() {
        if (this.readOnlyMode) {
            this.showMessage('❌ Режим только просмотра');
            return;
        }
        
        const name = prompt('Название комнаты:', 'Новая комната');
        if (!name) return;
        
        try {
            const newRoom = await api.createRoom({
                name: name,
                background: 'bg_default',
                items: []
            });
            
            this.rooms[newRoom.id] = {
                id: newRoom.id,
                name: newRoom.name,
                background: newRoom.background || 'bg_default',
                items: newRoom.items || []
            };
            this.currentRoomId = newRoom.id;
            this.currentRoomName = newRoom.name;
            this.updateRoomsUI();
            this.loadCurrentRoom();
            this.showMessage(`✅ Комната "${name}" создана`);
            this.saveRoomsToLocalStorage();
        } catch (error) {
            console.error('Ошибка создания комнаты:', error);
            this.showMessage('❌ Ошибка создания комнаты');
        }
    }
    
    async deleteRoom(roomId) {
        if (this.readOnlyMode) return;
        
        const room = this.rooms[roomId];
        if (!room) return;
        if (roomId === 'default') {
            this.showMessage('Нельзя удалить комнату по умолчанию');
            return;
        }
        
        if (confirm(`Удалить "${room.name}"?`)) {
            try {
                await api.deleteRoom(roomId);
                delete this.rooms[roomId];
                this.updateRoomsUI();
                this.saveRoomsToLocalStorage();
                
                const remainingRooms = Object.keys(this.rooms);
                if (remainingRooms.length > 0) {
                    const firstRoomId = remainingRooms[0];
                    this.currentRoomId = firstRoomId;
                    this.currentRoomName = this.rooms[firstRoomId].name;
                    this.loadCurrentRoom();
                } else {
                    await this.createDefaultRoom();
                }
                this.showMessage('✅ Комната удалена');
            } catch (error) {
                console.error('Ошибка удаления комнаты:', error);
                this.showMessage('❌ Ошибка удаления комнаты');
            }
        }
    }
    
    addMobileControls() {
        const controls = [
            { icon: '🗑', action: 'delete', x: 70, y: 700 },
            { icon: '🔄', action: 'rotate', x: 140, y: 700 },
            { icon: '📐', action: 'grid', x: 210, y: 700 },
            { icon: '🏠', action: 'background', x: 280, y: 700 },
            { icon: '🔒', action: 'lock', x: 350, y: 700 },
            { icon: '🔓', action: 'unlock', x: 420, y: 700 }
        ];
        
        controls.forEach(ctrl => {
            const btn = this.add.text(ctrl.x, ctrl.y, ctrl.icon, {
                fontSize: '28px',
                backgroundColor: '#000000aa',
                padding: { x: 8, y: 5 },
                borderRadius: 30
            }).setInteractive({ useHandCursor: true }).setDepth(1000);
            
            btn.on('pointerdown', () => {
                if (this.readOnlyMode) {
                    this.showMessage('❌ Режим только просмотра');
                    return;
                }
                switch(ctrl.action) {
                    case 'delete': this.deleteSelected(); break;
                    case 'rotate': this.rotateDirection(1); break;
                    case 'grid': this.toggleSnap(); break;
                    case 'background': this.cycleBackground(); break;
                    case 'lock': this.lockSelected(); break;
                    case 'unlock': this.unlockSelected(); break;
                }
            });
        });
    }
    
    setupUIEvents() {
        document.querySelectorAll('[data-category]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-category]').forEach(b => b.setAttribute('aria-selected', 'false'));
                btn.setAttribute('aria-selected', 'true');
                this.currentCategory = btn.dataset.category;
                console.log('📁 Выбрана категория:', this.currentCategory);
                this.updateFurnitureUI();
            });
        });
        
        const searchInput = document.getElementById('furniture-search');
        if (searchInput) {
            console.log('🔍 Поиск initialized');
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                console.log('🔍 Поиск:', this.searchQuery);
                this.updateFurnitureUI();
            });
        } else {
            console.error('❌ searchInput не найден!');
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
                <option value="bg_livingroom">🛋 Гостиная</option>
            `;
            bgSelect.onchange = (e) => this.changeBackground(e.target.value);
            this.updateBackgroundSelect();
        }
        
        const uploadBgBtn = document.getElementById('upload-bg-btn');
        if (uploadBgBtn) uploadBgBtn.addEventListener('click', () => this.uploadBackground());
        
        const lockBtn = document.getElementById('lock-selected');
        const unlockBtn = document.getElementById('unlock-selected');
        if (lockBtn) lockBtn.addEventListener('click', () => this.lockSelected());
        if (unlockBtn) unlockBtn.addEventListener('click', () => this.unlockSelected());
    }
}

export default EditorScene;