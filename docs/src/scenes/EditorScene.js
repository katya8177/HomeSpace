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

        setTimeout(() => this.refreshTaskMarkers(), 1000);
        
        if (this.isMobile) this.addMobileControls();
        
        console.log('✅ EditorScene ready');
    // Временно для отладки слоёв
window.testLayer = {
    up: () => {
        console.log('🔍 Тест bringToFront');
        console.log('  - readOnlyMode:', this.readOnlyMode);
        console.log('  - selectedItem:', this.selectedItem?.getData('name') || 'нет');
        console.log('  - depth:', this.selectedItem?.depth);
        if (this.selectedItem) {
            this.bringToFront();
            console.log('  - новый depth:', this.selectedItem?.depth);
        }
    },
    down: () => {
        console.log('🔍 Тест sendToBack');
        console.log('  - readOnlyMode:', this.readOnlyMode);
        console.log('  - selectedItem:', this.selectedItem?.getData('name') || 'нет');
        console.log('  - depth:', this.selectedItem?.depth);
        if (this.selectedItem) {
            this.sendToBack();
            console.log('  - новый depth:', this.selectedItem?.depth);
        }
    }
};
console.log('🔧 Отладка слоёв: testLayer.up() и testLayer.down()');
 document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.bringToFront();
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.sendToBack();
    }
});
console.log('✅ Стрелки ↑↓ для слоёв');  
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
        this.refreshTaskMarkers();
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
                itemInstanceId: sprite.getData('itemInstanceId'),
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
            }
        });
    }
    
    this.updateRoomsUI();
    this.updateBackgroundSelect();
    
    // ВАЖНО: обновляем маркеры после загрузки предметов
    setTimeout(() => this.refreshTaskMarkers(), 500);
    
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
                this.refreshTaskMarkers();
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

        const avatarHtml = (member) => {
            const a = member?.avatar;
            if (a && typeof a === 'string' && (a.startsWith('/assets/uploads/') || a.startsWith('/uploads/'))) {
                const url = `http://localhost:3001${a}`;
                return `<img src="${this.escapeHtml(url)}" alt="" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,0.25);">`;
            }
            if (a && typeof a === 'string' && a.startsWith('http')) {
                return `<img src="${this.escapeHtml(a)}" alt="" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,0.25);">`;
            }
            return `<span style="font-size:18px;">${this.escapeHtml(a || '👶')}</span>`;
        };
        
        for (const child of this.children) {
            const childRooms = await api.getChildRooms(child.id);
            
            html += `
                <div style="margin-bottom: 15px;">
                    <div style="font-weight: bold; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                        ${avatarHtml(child)}
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
                const childId = el.dataset.childId;
                if (roomId && childId) {
                    console.log('👶 Открываем комнату ребенка:', roomId);
                    console.log('👶 ID ребенка:', childId);
                    this.viewingChildId = childId;
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
        
        const marker = obj.getData('taskMarker');
        const text = obj.getData('taskText');
        if (marker) {
            marker.x = obj.x;
            marker.y = obj.y - 35;
        }
        if (text) {
            text.x = obj.x;
            text.y = obj.y - 35;
        }
        
        this.saveCurrentRoomToDB();
    });
    
    this.input.on('gameobjectdown', (pointer, obj) => {
        if (obj.type !== 'Sprite') return;
        
        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
            this.openTaskForItem(obj);
            return;
        }
        
        pendingItem = obj;
        clickTimer = setTimeout(() => {
            if (pendingItem) {
                if (!this.readOnlyMode) {
                    this.selectItem(pendingItem);
                } else {
                    if (this.selectedItem && this.selectedItem !== pendingItem) {
                        this.selectedItem.clearTint();
                    }
                    this.selectedItem = pendingItem;
                    pendingItem.setTint(0xffaa00);
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
            if (this.selectedItem.clearTint) this.selectedItem.clearTint();
            this.selectedItem = null;
        }
    });
    
    // ГОРЯЧИЕ КЛАВИШИ — для всех
    this.input.keyboard.on('keydown-PAGE_UP', (event) => {
        event.preventDefault();
        this.bringToFront();
    });
    
    this.input.keyboard.on('keydown-PAGE_DOWN', (event) => {
        event.preventDefault();
        this.sendToBack();
    });
    
    this.input.keyboard.on('keydown-DELETE', () => {
        if (!this.readOnlyMode) this.deleteSelected();
    });
    
    this.input.keyboard.on('keydown-G', () => this.toggleSnap());
    
    this.input.keyboard.on('keydown-Q', () => {
        if (!this.readOnlyMode) this.rotateDirection(-1);
    });
    
    this.input.keyboard.on('keydown-E', () => {
        if (!this.readOnlyMode) this.rotateDirection(1);
    });
    
    this.input.keyboard.on('keydown-ESC', () => this.exitPlacementMode());
    
    this.input.keyboard.on('keydown-L', () => {
        if (!this.readOnlyMode) this.lockSelected();
    });
    
    this.input.keyboard.on('keydown-U', () => {
        if (!this.readOnlyMode) this.unlockSelected();
    });
    
    this.input.keyboard.on('keydown-T', () => {
        if (this.currentUser?.role !== 'child' && this.selectedItem) {
            this.openTaskForItem(this.selectedItem);
        }
    });
    
    this.input.on('wheel', (pointer, obj, deltaX, deltaY) => {
        if (this.readOnlyMode) return;
        if (this.selectedItem && !this.isLocked(this.selectedItem)) {
            const newScale = Math.max(0.3, Math.min(2, this.selectedItem.scale - deltaY / 500));
            this.selectedItem.setScale(newScale);
            this.saveCurrentRoomToDB();
        }
    });
}
    
    async openTaskForItem(sprite) {
    if (this.currentUser?.role === 'child') {
        this.showMessage('❌ Детям нельзя создавать задания');
        return;
    }
    
    const itemType = sprite.getData('type');
    const itemInstanceId = sprite.getData('itemInstanceId');
    const itemName = sprite.getData('name');
    
    if (!itemType) {
        this.showMessage('Не удалось определить предмет');
        return;
    }
    
    let assignedTo = null;
    let assignedToName = 'Не назначено';
    
    if (this.viewingChildId) {
        // В комнате ребёнка — назначаем ребёнку
        const child = this.children.find(c => c.id === this.viewingChildId);
        if (child) {
            assignedTo = child.id;
            assignedToName = child.name;
        }
    } else if (this.currentUser?.role === 'parent') {
        // В СВОЕЙ комнате — назначаем СЕБЕ
        assignedTo = this.currentUser.id;
        assignedToName = this.currentUser.name;
    } else if (this.currentUser?.role === 'user') {
        assignedTo = this.currentUser.id;
        assignedToName = this.currentUser.name;
    }
    
    this.showTaskModal(itemType, itemInstanceId, itemName, assignedTo, assignedToName);
}
    
    showTaskModal(itemKey, itemInstanceId, itemName, presetAssignedTo, presetAssignedToName) {
    const oldModal = document.getElementById('task-modal-editor');
    if (oldModal) oldModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'task-modal-editor';
    modal.style.cssText = `
        display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); backdrop-filter: blur(12px); z-index: 10000;
        justify-content: center; align-items: center;
    `;
    
    // Адаптивные размеры для телефона
    const isMobile = this.isMobile;
    const padding = isMobile ? '20px' : '32px';
    const titleSize = isMobile ? '20px' : '26px';
    const inputPadding = isMobile ? '10px' : '14px';
    const btnSize = isMobile ? '44px' : '44px';
    
    let selectHtml = '';
    if (presetAssignedTo) {
        selectHtml = `<input type="hidden" id="task-assigned-editor" value="${presetAssignedTo}">
                      <div style="background: rgba(78,204,163,0.2); padding: 10px; border-radius: 8px; margin-bottom: 12px; text-align: center; font-size: ${isMobile ? '13px' : '15px'};">
                          👤 <strong>Назначено: ${presetAssignedToName}</strong>
                      </div>`;
    } else {
        selectHtml = '<label style="color:white; display:block; margin-bottom:5px; font-size:' + (isMobile ? '13px' : '14px') + ';">👤 Назначить:</label>';
        selectHtml += '<select id="task-assigned-editor" style="width:100%; padding:' + (isMobile ? '10px' : '12px') + '; background:rgba(44,62,80,0.8); border:1px solid rgba(78,204,163,0.3); border-radius:12px; color:white; font-size:' + (isMobile ? '14px' : '16px') + ';">';
        selectHtml += `<option value="">— Не назначено —</option>`;
        if (this.currentUser?.role === 'parent') {
            selectHtml += `<option value="${this.currentUser.id}">👑 Себе</option>`;
        }
        if (this.children && this.children.length > 0) {
            for (const child of this.children) {
                selectHtml += `<option value="${child.id}">👶 ${child.name}</option>`;
            }
        }
        selectHtml += '</select>';
    }
    
    modal.innerHTML = `
        <div style="background:linear-gradient(135deg, rgba(26,26,46,0.98), rgba(22,33,62,0.98)); border-radius:24px; padding:${padding}; max-width:${isMobile ? '95%' : '520px'}; width:90%; border:1px solid rgba(78,204,163,0.4);">
            <h3 style="color:#4ecca3; margin-bottom:20px; font-size:${titleSize}; text-align:center;">✨ Создать задание</h3>
            <input type="text" id="task-title-editor" placeholder="Название задания" autocomplete="off" value="Задание для ${itemName}" style="width:100%; padding:${inputPadding}; margin-bottom:14px; background:rgba(15,25,35,0.9); border:1px solid rgba(78,204,163,0.3); border-radius:12px; color:#fff; font-size:${isMobile ? '14px' : '16px'};">
            <textarea id="task-desc-editor" placeholder="Описание (необязательно)" style="width:100%; padding:${inputPadding}; margin-bottom:14px; background:rgba(15,25,35,0.9); border:1px solid rgba(78,204,163,0.3); border-radius:12px; color:#fff; resize:vertical; min-height:${isMobile ? '50px' : '80px'}; font-size:${isMobile ? '14px' : '16px'};"></textarea>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px; background:rgba(15,25,35,0.6); padding:8px 14px; border-radius:50px;">
                <span style="color:#ffd700; font-weight:600; font-size:${isMobile ? '13px' : '15px'}; white-space:nowrap;">💰 Бонус:</span>
                <button id="bonus-minus-editor" style="width:${btnSize}; height:${btnSize}; border-radius:50%; background:rgba(78,204,163,0.15); border:1px solid #4ecca3; color:#4ecca3; font-size:20px; cursor:pointer;">−</button>
                <input type="number" id="task-bonus-editor" value="10" min="1" max="100" style="flex:1; margin-bottom:0; text-align:center; font-weight:700; font-size:${isMobile ? '16px' : '18px'}; background:rgba(0,0,0,0.5); border:1px solid rgba(78,204,163,0.3); border-radius:12px; color:#fff; padding:10px;">
                <button id="bonus-plus-editor" style="width:${btnSize}; height:${btnSize}; border-radius:50%; background:rgba(78,204,163,0.15); border:1px solid #4ecca3; color:#4ecca3; font-size:20px; cursor:pointer;">+</button>
            </div>
            <div id="task-assigned-container">${selectHtml}</div>

            <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08);">
                <div style="color: rgba(255,255,255,0.85); font-weight: 700; margin-bottom: 8px; font-size:${isMobile ? '13px' : '14px'};">
                    ⏰ Автоматически повторять
                </div>
                <div style="display:flex; gap:10px; flex-wrap: wrap;">
                    <select id="task-recurrence-editor" style="flex:1; min-width: 160px; padding:${isMobile ? '10px' : '12px'}; background:rgba(44,62,80,0.8); border:1px solid rgba(78,204,163,0.3); border-radius:12px; color:white; font-size:${isMobile ? '14px' : '15px'};">
                        <option value="none">Не повторять</option>
                        <option value="daily">Каждый день</option>
                        <option value="weekly">По дням недели</option>
                        <option value="once">Один раз (дата)</option>
                    </select>
                    <input id="task-time-editor" type="time" value="09:00" style="flex:1; min-width: 140px; padding:${isMobile ? '10px' : '12px'}; background:rgba(44,62,80,0.8); border:1px solid rgba(78,204,163,0.3); border-radius:12px; color:white; font-size:${isMobile ? '14px' : '15px'};">
                </div>
                <div id="task-recur-extra-editor" style="margin-top: 10px; display:none;">
                    <div id="task-dows-editor" style="display:none; flex-wrap:wrap; gap:8px;">
                        ${[
                            { v: 1, t: 'Пн' },
                            { v: 2, t: 'Вт' },
                            { v: 3, t: 'Ср' },
                            { v: 4, t: 'Чт' },
                            { v: 5, t: 'Пт' },
                            { v: 6, t: 'Сб' },
                            { v: 0, t: 'Вс' }
                        ].map(d => `
                            <label style="display:inline-flex; align-items:center; gap:8px; padding:10px 12px; border-radius:999px; border:1px solid rgba(255,255,255,0.14); background: rgba(44, 62, 80, 0.55); cursor:pointer; font-size:${isMobile ? '13px' : '14px'}; color:#fff;">
                                <input type="checkbox" data-dow="${d.v}" style="width:16px; height:16px; accent-color:#4ecca3;">
                                <span>${d.t}</span>
                            </label>
                        `).join('')}
                    </div>
                    <input id="task-runat-editor" type="datetime-local" style="width:100%; padding:${isMobile ? '10px' : '12px'}; background:rgba(44,62,80,0.8); border:1px solid rgba(78,204,163,0.3); border-radius:12px; color:white; font-size:${isMobile ? '14px' : '15px'}; display:none;" />
                </div>
                <div style="margin-top: 8px; color: rgba(255,255,255,0.55); font-size:${isMobile ? '11px' : '12px'}; line-height: 1.35;">
                    Если выбрать повтор — задание будет создаваться автоматически по расписанию.
                </div>
            </div>

            <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:20px;">
                <button id="task-cancel-editor" style="padding:${isMobile ? '10px 20px' : '12px 28px'}; border-radius:40px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:rgba(255,255,255,0.8); cursor:pointer; font-size:${isMobile ? '13px' : '15px'};">Отмена</button>
                <button id="task-save-editor" style="padding:${isMobile ? '10px 24px' : '12px 32px'}; border-radius:40px; background:linear-gradient(135deg, #4ecca3, #2c8f6e); border:none; color:white; cursor:pointer; font-size:${isMobile ? '13px' : '15px'};">Создать</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    const titleInput = modal.querySelector('#task-title-editor');
    const descInput = modal.querySelector('#task-desc-editor');
    const bonusInput = modal.querySelector('#task-bonus-editor');
    const recurrenceSelect = modal.querySelector('#task-recurrence-editor');
    const timeInput = modal.querySelector('#task-time-editor');
    const extraWrap = modal.querySelector('#task-recur-extra-editor');
    const dowsWrap = modal.querySelector('#task-dows-editor');
    const runAtInput = modal.querySelector('#task-runat-editor');

    function updateRecurrenceUI() {
        const v = recurrenceSelect?.value || 'none';
        if (!extraWrap || !dowsWrap || !runAtInput || !timeInput) return;
        if (v === 'weekly') {
            extraWrap.style.display = 'block';
            dowsWrap.style.display = 'flex';
            runAtInput.style.display = 'none';
            timeInput.style.display = 'block';
        } else if (v === 'once') {
            extraWrap.style.display = 'block';
            dowsWrap.style.display = 'none';
            runAtInput.style.display = 'block';
            timeInput.style.display = 'none';
        } else {
            extraWrap.style.display = 'none';
            dowsWrap.style.display = 'none';
            runAtInput.style.display = 'none';
            timeInput.style.display = 'block';
        }
    }
    if (recurrenceSelect) recurrenceSelect.onchange = updateRecurrenceUI;
    updateRecurrenceUI();
    
    modal.querySelector('#task-cancel-editor').onclick = () => modal.remove();
    
    modal.querySelector('#bonus-plus-editor').onclick = () => {
        let val = parseInt(bonusInput.value) || 10;
        bonusInput.value = val + 1;
    };
    
    modal.querySelector('#bonus-minus-editor').onclick = () => {
        let val = parseInt(bonusInput.value) || 10;
        if (val > 1) bonusInput.value = val - 1;
    };
    
    modal.querySelector('#task-save-editor').onclick = async () => {
        const title = titleInput.value.trim();
        if (!title) { alert('Введите название задания'); return; }
        
        let assignedTo = presetAssignedTo;
        if (!assignedTo) {
            const assignedToSelect = modal.querySelector('#task-assigned-editor');
            assignedTo = assignedToSelect ? assignedToSelect.value || null : null;
        }
        
        const bonus = parseInt(bonusInput.value) || 10;
        const description = descInput.value.trim();
         console.log('📤 ДАННЫЕ ДЛЯ ОТПРАВКИ:', {
        itemKey: itemKey,
        itemInstanceId: itemInstanceId,
        title: title,
        assignedTo: assignedTo
    });
        try {
            const recurrence = recurrenceSelect?.value || 'none';
            if (recurrence && recurrence !== 'none') {
                const tzOffset = -new Date().getTimezoneOffset();
                const scheduleType = recurrence; // daily | weekly | once
                let daysOfWeek = undefined;
                let runAt = undefined;
                if (scheduleType === 'weekly') {
                    daysOfWeek = Array.from(modal.querySelectorAll('#task-dows-editor input[type="checkbox"][data-dow]'))
                        .filter(i => i.checked)
                        .map(i => Number(i.dataset.dow));
                    if (!daysOfWeek.length) {
                        alert('Выберите хотя бы один день недели');
                        return;
                    }
                }
                if (scheduleType === 'once') {
                    runAt = runAtInput?.value;
                    if (!runAt) {
                        alert('Выберите дату и время');
                        return;
                    }
                }
                const payload = {
                    title,
                    description,
                    bonus,
                    assignedTo,
                    itemKey,
                    itemInstanceId,
                    scheduleType,
                    timeOfDay: scheduleType === 'once' ? undefined : (timeInput?.value || '09:00'),
                    daysOfWeek,
                    runAt,
                    timezoneOffsetMin: tzOffset
                };
                const result = await api.createTaskSchedule(payload);
                console.log('✅ Автозадание создано:', result);
                this.showMessage(`✅ Автозадание "${title}" создано!`);
            } else {
                const result = await api.createTask({
                    title, description, bonus, assignedTo,
                    itemKey, itemInstanceId
                });
                console.log('✅ Задание создано:', result);
                this.showMessage(`✅ Задание "${title}" создано!`);
            }
            modal.remove();
            setTimeout(() => this.refreshTaskMarkers(), 500);
        } catch (error) {
            console.error('❌ Ошибка создания задания:', error);
            alert('Не удалось создать задание: ' + (error.message || 'Ошибка сервера'));
        }
    };
}
    
    async refreshTaskMarkers() {
    this.clearAllMarkers();
    
    const sprites = this.furnitureGroup.getChildren();
    console.log(`🔄 Обновление маркеров для ${sprites.length} предметов`);
    
    // Показываем маркер на КАЖДОМ предмете, у которого есть задания
    for (const sprite of sprites) {
        await this.updateTaskMarkerForItem(sprite);
    }
}
    
   async updateTaskMarkerForItem(sprite) {
    const itemType = sprite.getData('type');
    const itemInstanceId = sprite.getData('itemInstanceId');
    if (!itemType || !itemInstanceId) return;
    
    try {
        const allTasks = await api.getTasks({ itemKey: itemType });
        const activeTasks = allTasks.filter(t => 
            t.status !== 'completed' && 
            t.item_instance_id === itemInstanceId
        );
        
        let visibleTasks = [];
        
        if (this.currentUser?.role === 'child') {
            // Ребёнок видит задания, назначенные ему
            visibleTasks = activeTasks.filter(t => t.assigned_to === this.currentUser.id);
        } else if (this.currentUser?.role === 'parent' && this.viewingChildId) {
            // В комнате ребёнка — показываем задания, назначенные этому ребёнку
            visibleTasks = activeTasks.filter(t => t.assigned_to === this.viewingChildId);
        } else if (this.currentUser?.role === 'parent' && !this.viewingChildId) {
    // В своей комнате показываем только СВОИ задания (которые назначены родителю)
    visibleTasks = activeTasks.filter(t => t.assigned_to === this.currentUser.id);
} else if (this.currentUser?.role === 'user') {
            visibleTasks = activeTasks.filter(t => t.assigned_to === this.currentUser.id);
        }
        
        const oldMarker = sprite.getData('taskMarker');
        const oldText = sprite.getData('taskText');
        if (oldMarker) { oldMarker.destroy(); sprite.setData('taskMarker', null); }
        if (oldText) { oldText.destroy(); sprite.setData('taskText', null); }
        
        if (visibleTasks.length > 0) {
            const marker = this.add.circle(sprite.x, sprite.y - 35, 16, 0xe94560)
                .setStrokeStyle(2, 0xffffff).setDepth(100);
            const text = this.add.text(sprite.x, sprite.y - 35, visibleTasks.length.toString(), {
                fontSize: '12px', fill: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(101);
            
            marker.setInteractive({ useHandCursor: true });
            text.setInteractive({ useHandCursor: true });
            const handler = () => this.showTaskModalForItem(sprite, visibleTasks);
            marker.on('pointerdown', handler);
            text.on('pointerdown', handler);
            
            sprite.setData('taskMarker', marker);
            sprite.setData('taskText', text);
        }
    } catch (error) {
        console.error('Ошибка загрузки заданий:', error);
    }
}
    
showTaskModalForItem(sprite, tasks) {
    if (!tasks || tasks.length === 0) return;
    
    const itemName = sprite.getData('name') || 'предмета';
    
    // Создаём модалку для просмотра заданий
    const modal = document.createElement('div');
    modal.style.cssText = `
        display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); backdrop-filter: blur(12px); z-index: 10000;
        justify-content: center; align-items: center;
    `;
    
    let tasksHtml = '<div style="max-height: 400px; overflow-y: auto; margin: 15px 0;">';
    tasks.forEach(task => {
        const statusIcon = task.status === 'completed' ? '✅' : '⏳';
        tasksHtml += `
            <div style="background: rgba(15,25,35,0.6); border-radius: 14px; padding: 14px; margin-bottom: 10px; border-left: 3px solid ${task.status === 'completed' ? '#4ecca3' : '#e94560'};">
                <div style="font-weight: 700; color: #ffffff; display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>${statusIcon} ${this.escapeHtml(task.title)}</span>
                    <span style="color: #ffd700;">💰 ${task.bonus}</span>
                </div>
                ${task.description ? `<div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 6px;">📝 ${this.escapeHtml(task.description)}</div>` : ''}
                <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 8px;">
                    👤 ${task.assigned_to_name || 'Не назначено'} | ✏️ от ${task.created_by_name}
                </div>
            </div>
        `;
    });
    tasksHtml += '</div>';
    
    modal.innerHTML = `
        <div style="background:linear-gradient(135deg, rgba(26,26,46,0.98), rgba(22,33,62,0.98)); border-radius:28px; padding:32px; max-width:520px; width:90%; border:1px solid rgba(78,204,163,0.4);">
            <h3 style="color:#4ecca3; margin-bottom: 20px; font-size: 24px; text-align: center;">📋 Задания для "${this.escapeHtml(itemName)}"</h3>
            ${tasksHtml}
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                <button id="task-modal-close" style="padding: 10px 25px; border-radius: 30px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); cursor: pointer;">Закрыть</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#task-modal-close').onclick = () => modal.remove();
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        this.showMessage(`Слой: ${newDepth} (Ctrl+клик для изменения)`);
        this.saveCurrentRoomToDB();
    }
    
    bringToFront() {
    if (this.readOnlyMode) { this.showMessage('❌ Только просмотр'); return; }
    if (!this.selectedItem) { this.showMessage('Сначала выберите предмет'); return; }
    if (this.isLocked(this.selectedItem)) { this.showMessage('🔒 Предмет закреплён'); return; }
    
    this.selectedItem.depth += 1;
    this.showMessage(`⬆️ Слой ${this.selectedItem.depth}`);
    this.saveCurrentRoomToDB();
}

sendToBack() {
    if (this.readOnlyMode) { this.showMessage('❌ Только просмотр'); return; }
    if (!this.selectedItem) { this.showMessage('Сначала выберите предмет'); return; }
    if (this.isLocked(this.selectedItem)) { this.showMessage('🔒 Предмет закреплён'); return; }
    
    this.selectedItem.depth = Math.max(1, this.selectedItem.depth - 1);
    this.showMessage(`⬇️ Слой ${this.selectedItem.depth}`);
    this.saveCurrentRoomToDB();
}
    
    
    selectItem(item) {
        if (!item || typeof item.setTint !== 'function') {
            return;
        }
        
        if (this.selectedItem && this.selectedItem !== item) {
            if (this.selectedItem.clearTint && typeof this.selectedItem.clearTint === 'function') {
                this.selectedItem.clearTint();
            }
        }
        this.selectedItem = item;
        
        if (this.isLocked(item)) {
            item.setTint(0xff6666);
        } else {
            item.setTint(0xffaa00);
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
            this.showMessage(`🔒 ${this.selectedItem.getData('name') || 'Предмет'} закреплен (L)`);
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
            this.showMessage(`🔓 ${this.selectedItem.getData('name') || 'Предмет'} разблокирован (U)`);
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
    const tex = `${furnitureId}_${direction}`;
    if (!this.textures.exists(tex)) return null;
    
    const sprite = this.add.sprite(x, y, tex);
    
    // ВАЖНО: если предмет уже сохранён в БД/комнате — сохраняем его itemInstanceId,
    // иначе маркеры заданий "теряются" после перезагрузки/обновления.
    const uniqueItemId = existingInstanceId || `${furnitureId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🆔 Предмет создан: ${furnitureId}, instanceId: ${uniqueItemId}`);
    
    sprite.setData('type', furnitureId);
    sprite.setData('itemInstanceId', uniqueItemId);
    sprite.setData('direction', direction);
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
    
    return sprite;
}
    
createInstruction() {
    if (this.instructionText) this.instructionText.destroy();
    
    let text;
    if (this.readOnlyMode) {
        text = '👁️ Режим просмотра | Двойной клик → задание | T → задание';
    } else {
        if (this.isMobile) {
            text = '📱 Предмет → поле | 📋 Задание | ⬆️⬇️ Слои';
        } else {
            text = '🖱 Предмет → поле | 2x клик задание | PgUp/PgDn слои | G сетка | L/U закрепить';
        }
    }
    
    this.instructionText = this.add.text(640, this.isMobile ? 720 : 750, text, {
        fontSize: this.isMobile ? '10px' : '11px',
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
        
        if (this.instructionText) this.instructionText.destroy();
        
        this.instructionText = this.add.text(640, this.isMobile ? 720 : 750, 
            `📌 ${furnitureId} | Клик на поле | ESC отмена`, 
            {
                fontSize: '10px',
                color: '#ffd700',
                backgroundColor: '#000000aa',
                padding: { x: 10, y: 5 }
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
        if (!container) return;
        
        let filtered = [...this.furnitureCatalog];
        
        if (this.currentCategory !== 'all') {
            filtered = filtered.filter(f => f.category === this.currentCategory);
        }
        
        if (this.searchQuery && this.searchQuery.trim() !== '') {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(f => f.name.toLowerCase().includes(query));
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
    
    addMobileControls() {
        if (document.getElementById('mobile-toolbar')) return;
        
        const toolbar = document.createElement('div');
        toolbar.id = 'mobile-toolbar';
        toolbar.style.cssText = `
            position: fixed; bottom: 10px; left: 10px; right: 10px;
            display: flex; justify-content: space-around; gap: 6px; z-index: 1999;
            background: rgba(15, 15, 26, 0.95); backdrop-filter: blur(10px);
            padding: 8px 6px; border-radius: 40px;
            border: 1px solid rgba(78, 204, 163, 0.6);
        `;
        
        const buttons = [
            { icon: '⬆️', title: 'Вперёд', action: () => this.bringToFront() },
            { icon: '⬇️', title: 'Назад', action: () => this.sendToBack() },
            { icon: '🗑️', title: 'Удалить', action: () => { if (!this.readOnlyMode) this.deleteSelected(); } },
            { icon: '🔄', title: 'Поворот', action: () => { if (!this.readOnlyMode) this.rotateDirection(1); } },
            { icon: '📐', title: 'Сетка', action: () => this.toggleSnap() },
            { icon: '📋', title: 'Задание', action: () => {
                if (this.currentUser?.role !== 'child' && this.selectedItem) {
                    this.openTaskForItem(this.selectedItem);
                }
            }}
        ];
        
        buttons.forEach(b => {
            const btn = document.createElement('button');
            btn.textContent = b.icon;
            btn.title = b.title;
            btn.style.cssText = `
                width: 44px; height: 44px; border-radius: 50%;
                background: rgba(78, 204, 163, 0.2); border: 1px solid rgba(78, 204, 163, 0.5);
                color: white; font-size: 20px; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
            `;
            btn.addEventListener('click', b.action);
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); b.action(); });
            toolbar.appendChild(btn);
        });
        
        document.body.appendChild(toolbar);
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