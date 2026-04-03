// src/scenes/EditorScene.js
import { furnitureData, getItemsByCategory } from '../config/furniture.js';
import { api } from '../services/api.js';
import { createRoundedTextButton } from '../utils/ui.js';
import { loadCategoryFurniture, loadSingleTexture } from '../utils/assetLoader.js';
import { createDisposables, createNotificationManager } from '../utils/sceneUi.js';

export class EditorScene extends Phaser.Scene {
    constructor() {
        super('EditorScene');
        
        // Основные данные
        this.items = [];
        this.selectedCategory = 'livingroom';
        this.selectedItem = null;
        this.selectedRotation = null;
        this.placementMode = false;
        this.previewItem = null;
        this.gridSize = 64;
        this.roomName = 'Моя комната';
        this.taskMode = false;
        this.tasks = [];
        
        // Камера
        this.cameraZoom = 1;
        this.minZoom = 0.5;
        this.maxZoom = 2;
        this.cellHighlight = null;
        
        // Система бонусов
        this.bonuses = {
            users: {},
            family: 0,
            history: []
        };
        
        // Данные пользователя
        this.currentUser = null;
        this.isAdmin = false;
        
        // Настройки заданий
        this.taskSettings = {
            defaultBonus: 10,
            canChange: true
        };
        
        // Элементы интерфейса
        this.taskList = null;
        this.selectedFurniture = null;
        this.instruction = null;
        this.bonusText = null;
        this.bonusPanel = null;
        this.itemPanel = [];
        
        // Состояние
        this.isLoading = false;
        this.roomId = null;
        
        // Кэш загруженных категорий
        this.loadedCategories = new Set();
        
        // Для панели выбора предметов
        this.itemSelectorPanel = null;
        this.itemSelectorItems = [];
        this.itemSelectorScrollY = 0;
        this.itemSelectorMaxScroll = 0;
        this.itemSelectorWheelHandler = null;
        this.isPanelCollapsed = false;

        this.categoryScrollPositions = {};

        this.itemTasks = {};

        // Выделение
        this.selectionGraphics = null;
        this.dragFeedbackGraphics = null;

        // Утечки/очистка
        this._disposables = createDisposables();
        this._notifier = null;

        // Перемещение/точность
        this.snapToGridEnabled = false;

        // Автосохранение
        this._autosaveTimer = null;
        this._dirty = false;

        // Фон комнаты
        this._bgKey = 'sky';
        this._bgRect = null;
        this._bgSprite = null;
        this._bgTexture = null;
    }
    
    create() {
        const { width, height } = this.cameras.main;
        console.log('EditorScene create started');
        this.add.text(20, 20, 'EditorScene active', { fontSize: '18px', fill: '#ffff00' }).setDepth(9999);
        this.add.rectangle(100, 120, 50, 50, 0xff0000, 0.6).setDepth(9998);
        window.editorSceneReady = true;
        
        // Загружаем пользователя
        this.loadCurrentUser();
        this.loadBonuses();
        
        // Фон
        this._bgRect = this.add.rectangle(0, 0, width, height, 0x7faee1).setOrigin(0, 0);
        
        // Сетка комнаты
        this.gridGraphics = this.add.graphics();
        this.drawGrid();
        
        // Управление камерой
        this.setupCameraControls();
        
        // Подсветка ячейки
        this.setupCellHighlight();

        // Графика выделения
        this.selectionGraphics = this.add.graphics().setDepth(1999);
        this.dragFeedbackGraphics = this.add.graphics().setDepth(1998);

        // Уведомления
        this._notifier = createNotificationManager(this, { startY: 105, maxVisible: 3, depth: 4000 });
        this._disposables.add(() => this._notifier?.destroy());

        // Глобальная очистка
        this.events.once('shutdown', () => this._disposables.run());
        this.events.once('destroy', () => this._disposables.run());
        const onBeforeUnload = (e) => {
            if (this._dirty) {
                e.preventDefault();
                e.returnValue = 'Есть несохранённые изменения. Вы уверены?';
            }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        this._disposables.add(() => window.removeEventListener('beforeunload', onBeforeUnload));
        
        // ========== ВЕРХНЯЯ ПАНЕЛЬ КНОПОК ==========
        const buttonY = 30;
        const leftStartX = 80;
        const buttonSpacing = 15;
        
        // Левая группа
        let leftX = leftStartX;
        
        // Кнопка назад
        const backBtn = createRoundedTextButton(this, {
            x: leftX,
            y: buttonY,
            radius: 14,
            fillColor: 0x07488d,
            hoverFillColor: 0x6fe3b5,
            text: '← Назад',
            textStyle: { fontSize: '18px', fill: '#fafafa' },
            onClick: async () => {
                console.log('Назад нажата');
                await this.forceSaveBeforeExit();
                this.scene.start('MenuScene');
            }
        });
        
        if (backBtn) {
            backBtn.setDepth(200);
        }
        leftX += 100 + buttonSpacing;
        
        // Кнопка заданий
        const taskModeBtn = this.add.text(leftX, buttonY, 'Задания', {
            fontSize: '18px',
            fill: this.taskMode ? '#4ecca3' : '#ffffff',
            backgroundColor: '#232931',
            padding: { x: 12, y: 8 }
        }).setInteractive({ useHandCursor: true });
        taskModeBtn.setOrigin(0.5);
        taskModeBtn.setDepth(200);
        
        taskModeBtn.on('pointerdown', (pointer, localX, localY, event) => {
            if (event) event.stopPropagation();
            this.taskMode = !this.taskMode;
            taskModeBtn.setFill(this.taskMode ? '#4ecca3' : '#ffffff');
            this.exitPlacementMode();
            this.createInstruction();
            
            if (this.taskMode) {
                this.showNotification('Режим заданий: кликните на предмет, чтобы создать задание', '#4ecca3');
                this.input.setDefaultCursor('crosshair');
            } else {
                this.showNotification('Режим заданий выключен', '#888888');
                this.input.setDefaultCursor('default');
                if (this.taskList) {
                    this.taskList.forEach(el => {
                        if (el && !el.destroyed) el.destroy();
                    });
                    this.taskList = null;
                }
            }
        });
        leftX += 100 + buttonSpacing;
        
        // Кнопка истории
        let historyBtn = null;
        if (this.isAdmin) {
            historyBtn = this.add.text(leftX, buttonY, 'История', {
                fontSize: '18px',
                fill: '#ffffff',
                backgroundColor: '#232931',
                padding: { x: 12, y: 8 }
            }).setInteractive({ useHandCursor: true });
            historyBtn.setOrigin(0.5);
            historyBtn.setDepth(200);
            
            historyBtn.on('pointerdown', (pointer, localX, localY, event) => {
                if (event) event.stopPropagation();
                this.showBonusHistory();
            });
        }
        
        // Кнопка центрирования
        const centerBtn = this.add.text(width - 380, 30, 'Центр', {
            fontSize: '16px',
            fill: '#ffffff',
            backgroundColor: '#ffd700',
            padding: { x: 10, y: 6 }
        }).setInteractive({ useHandCursor: true });
        centerBtn.setOrigin(0.5);
        centerBtn.setDepth(200);
        centerBtn.on('pointerdown', () => {
            this.refreshAllItems();
            this.showNotification('Предметы центрированы', '#ffd700');
        });
        
        // ========== ПАНЕЛЬ БОНУСОВ ==========
        this.createBonusPanel();
        
        // Индикатор загрузки
        this.loadingText = this.add.text(width/2, height/2, 'Загрузка...', {
            fontSize: '24px',
            fill: '#aaaaaa'
        }).setOrigin(0.5);
        this.loadingText.setVisible(false);
        
        // Предпросмотр при движении мыши
        this.input.on('pointermove', (pointer) => {
            if (this.placementMode && this.selectedItem && this.previewItem) {
                const camera = this.cameras.main;
                const worldX = pointer.x + camera.scrollX;
                const worldY = pointer.y + camera.scrollY;
                
                const target = this.snapToGridEnabled ? this.snapToGrid(worldX, worldY) : { x: worldX, y: worldY };
                const finalX = target.x;
                const finalY = target.y;
                
                const { minX, minY, maxX, maxY } = this.getWorldBoundsPadding(50);
                const clampX = Math.min(maxX, Math.max(minX, finalX));
                const clampY = Math.min(maxY, Math.max(minY, finalY));
                
                this.previewItem.setPosition(clampX, clampY);
                
                const canPlace = this.canPlaceItemAt(this.selectedItem, this.selectedRotation, clampX, clampY, null);
                this.previewItem.setAlpha(canPlace ? 0.7 : 0.3);
                this.previewItem.setTint(canPlace ? 0xffffff : 0xff6666);
            }
        });
        
        // Обработчик клика
        this.input.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown()) {
                if (this.placementMode && this.selectedItem) {
                    this.placeItem(pointer);
                } else if (this.taskMode) {
                    this.createTask(pointer);
                }
            }
        });
        
        // ESC для выхода
        this.input.keyboard.on('keydown-ESC', () => {
            this.exitPlacementMode();
            if (this.taskMode) {
                this.taskMode = false;
                taskModeBtn.setFill('#ffffff');
                this.input.setDefaultCursor('default');
                if (this.taskList) {
                    this.taskList.forEach(el => {
                        if (el && !el.destroyed) el.destroy();
                    });
                    this.taskList = null;
                }
                this.createInstruction();
            }
        });
        
        // DELETE для удаления выбранного предмета
        this.input.keyboard.on('keydown-DELETE', () => {
            this.deleteSelectedItem();
        });
        
        // R для поворота
        this.input.keyboard.on('keydown-R', () => {
            if (this.selectedFurniture) {
                this.rotateItem(this.selectedFurniture);
            }
        });
        
        // Q/E для масштабирования
        this.input.keyboard.on('keydown-Q', () => {
            if (this.selectedFurniture) {
                this.scaleItem(this.selectedFurniture, -0.1);
            }
        });
        
        this.input.keyboard.on('keydown-E', () => {
            if (this.selectedFurniture) {
                this.scaleItem(this.selectedFurniture, 0.1);
            }
        });

        // G — переключение привязки к сетке
        this.input.keyboard.on('keydown-G', () => {
            this.snapToGridEnabled = !this.snapToGridEnabled;
            this.drawGrid();
            this.showNotification(
                this.snapToGridEnabled ? 'Привязка к сетке: ВКЛ (G)' : 'Привязка к сетке: ВЫКЛ (G)',
                this.snapToGridEnabled ? '#4ecca3' : '#888888'
            );
        });
        
        // Инструкции
        this.createInstruction();
        
        // Отключаем контекстное меню
        this.input.mouse.disableContextMenu();
        
        // Загружаем комнату/задания
        this.bootstrapRoomAndTasks();
        console.log('EditorScene bootstrap requested');
        
        // Обработчик для выделения предметов
        this.input.on('gameobjectdown', (pointer, gameObject) => {
            if (gameObject.data && gameObject.data.key) {
                if (pointer.rightButtonDown()) {
                    this.rotateItem(gameObject);
                } else if (pointer.leftButtonDown() && !this.placementMode && !this.taskMode) {
                    this.selectItem(gameObject);
                }
            }
        });
    }

    drawGrid() {
        if (!this.gridGraphics) return;
        this.gridGraphics.clear();
        
        if (!this.snapToGridEnabled) return;
        
        const { width, height } = this.cameras.main;
        const camera = this.cameras.main;
        const startX = Math.floor(camera.scrollX / this.gridSize) * this.gridSize;
        const startY = Math.floor(camera.scrollY / this.gridSize) * this.gridSize;
        const endX = startX + width + this.gridSize;
        const endY = startY + height + this.gridSize;
        
        this.gridGraphics.lineStyle(1, 0x4ecca3, 0.3);
        
        for (let x = startX; x <= endX; x += this.gridSize) {
            this.gridGraphics.moveTo(x, startY);
            this.gridGraphics.lineTo(x, endY);
        }
        
        for (let y = startY; y <= endY; y += this.gridSize) {
            this.gridGraphics.moveTo(startX, y);
            this.gridGraphics.lineTo(endX, y);
        }
        
        this.gridGraphics.strokePath();
    }

    async bootstrapRoomAndTasks() {
        await this.loadRoom();
        await this.loadTasksFromServer();
        this.checkTasksSync();
        this.refreshAllItems();
        this.updateSelectionOutline();
        console.log('Items loaded:', this.items.length);
        console.log('Textures loaded:', Object.keys(this.textures.list || {}).length);

        this.setupHtmlFurnitureUi();
    }

    setupHtmlFurnitureUi() {
        const root = document.getElementById('ui-root');
        const panel = document.getElementById('furniture-panel');
        const toggle = document.getElementById('furniture-toggle');
        const search = document.getElementById('furniture-search');
        const cats = document.getElementById('furniture-categories');
        const list = document.getElementById('furniture-list');
        const snapToggle = document.getElementById('snap-toggle');
        const deleteBtn = document.getElementById('delete-selected');
        const roomSelect = document.getElementById('room-select');
        const roomNew = document.getElementById('room-new');
        const bgSelect = document.getElementById('bg-select');
        
        if (!root || !panel || !toggle || !search || !cats || !list) return;
        root.style.display = 'block';
        this._disposables.add(() => { root.style.display = 'none'; });

        const categories = [
            { key: 'base', name: 'Основа' },
            { key: 'livingroom', name: 'Гостиная' },
            { key: 'bedroom', name: 'Спальня' },
            { key: 'kitchen', name: 'Кухня' },
            { key: 'bathroom', name: 'Ванная' },
            { key: 'decor', name: 'Декор' },
            { key: 'electronics', name: 'Электроника' }
        ];

        const state = {
            open: panel.getAttribute('data-open') !== 'false',
            category: this.selectedCategory || 'livingroom',
            q: ''
        };

        const setOpen = (open) => {
            state.open = open;
            panel.setAttribute('data-open', open ? 'true' : 'false');
            toggle.textContent = open ? '⟨' : '⟩';
            toggle.setAttribute('aria-label', open ? 'Свернуть панель' : 'Развернуть панель');
        };

        const loadRoomNames = async () => {
            try {
                const remote = await api.getRoomsList();
                const remoteNames = Array.isArray(remote) ? remote.map(r => r.name).filter(Boolean) : [];
                const raw = localStorage.getItem(`homespace_room_names_${this.currentUser?.id || 'guest'}`);
                const list = raw ? JSON.parse(raw) : null;
                const base = Array.isArray(list) ? list : [];
                if (!base.includes(this.roomName)) base.unshift(this.roomName);
                return Array.from(new Set([...remoteNames, ...base])).slice(0, 50);
            } catch {
                return [this.roomName];
            }
        };
        
        const saveRoomNames = (names) => {
            try { localStorage.setItem(`homespace_room_names_${this.currentUser?.id || 'guest'}`, JSON.stringify(names)); } catch { /* noop */ }
        };
        
        const renderRooms = async () => {
            if (!roomSelect) return;
            const names = await loadRoomNames();
            saveRoomNames(names);
            roomSelect.innerHTML = '';
            for (const n of names) {
                const opt = document.createElement('option');
                opt.value = n;
                opt.textContent = n;
                if (n === this.roomName) opt.selected = true;
                roomSelect.appendChild(opt);
            }
        };
        
        const switchRoom = async (name) => this.switchRoom(name, renderRooms);
        
        const onRoomChange = () => switchRoom(roomSelect?.value);
        roomSelect?.addEventListener('change', onRoomChange);
        
        const onRoomNew = async () => {
            const base = await loadRoomNames();
            const name = `Комната ${base.length + 1}`;
            base.unshift(name);
            saveRoomNames(base);
            await switchRoom(name);
        };
        roomNew?.addEventListener('click', onRoomNew);
        
        // Кнопка переименования комнаты
        const renameBtn = document.createElement('button');
        renameBtn.className = 'chip';
        renameBtn.textContent = '✎ Переименовать';
        renameBtn.type = 'button';
        renameBtn.addEventListener('click', () => {
            const newName = prompt('Введите новое название комнаты:', this.roomName);
            if (newName && newName.trim()) {
                const oldName = this.roomName;
                this.roomName = newName.trim();
                this.markDirty();
                const names = loadRoomNames();
                const index = names.indexOf(oldName);
                if (index !== -1) names[index] = this.roomName;
                saveRoomNames(names);
                renderRooms();
                this.showNotification(`Комната переименована в "${this.roomName}"`, '#4ecca3');
            }
        });
        roomNew?.parentNode?.insertBefore(renameBtn, roomNew.nextSibling);
        
        renderRooms();

        // Background presets + custom upload
        const backgrounds = [
            { key: 'sky', name: 'Небо', color: 0x7faee1 },
            { key: 'night', name: 'Ночь', color: 0x0f0f1a },
            { key: 'sand', name: 'Песок', color: 0xd9c7a6 },
            { key: 'mint', name: 'Мята', color: 0x7bdcb5 },
            { key: 'lavender', name: 'Лаванда', color: 0xb8a1ff }
        ];
        
        const applyBg = (key, customTexture = null) => {
            if (customTexture) {
                if (this._bgSprite) this._bgSprite.destroy();
                if (this._bgRect) this._bgRect.setVisible(false);
                this._bgSprite = this.add.image(0, 0, customTexture).setOrigin(0, 0);
                const scaleX = this.cameras.main.width / this._bgSprite.width;
                const scaleY = this.cameras.main.height / this._bgSprite.height;
                this._bgSprite.setScale(Math.max(scaleX, scaleY));
                this._bgSprite.setDepth(-10);
                this._bgKey = 'custom';
                this.markDirty();
                return;
            }
            
            if (this._bgSprite) {
                this._bgSprite.destroy();
                this._bgSprite = null;
            }
            if (this._bgRect) this._bgRect.setVisible(true);
            
            const bg = backgrounds.find(b => b.key === key) || backgrounds[0];
            this._bgKey = bg.key;
            if (this._bgRect) this._bgRect.setFillStyle(bg.color);
            this.markDirty();
        };
        
        const renderBg = () => {
            if (!bgSelect) return;
            bgSelect.innerHTML = '';
            for (const bg of backgrounds) {
                const opt = document.createElement('option');
                opt.value = bg.key;
                opt.textContent = bg.name;
                if (bg.key === this._bgKey) opt.selected = true;
                bgSelect.appendChild(opt);
            }
            const customOpt = document.createElement('option');
            customOpt.value = 'custom';
            customOpt.textContent = 'Моё фото';
            if (this._bgKey === 'custom') customOpt.selected = true;
            bgSelect.appendChild(customOpt);
        };
        
        const onBg = () => {
            const val = bgSelect?.value;
            if (val === 'custom') {
                // Показываем загрузку
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file && file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            const img = new Image();
                            img.onload = () => {
                                const textureKey = `custom_bg_${Date.now()}`;
                                if (this.textures.exists(textureKey)) this.textures.remove(textureKey);
                                this.textures.addImage(textureKey, img);
                                applyBg('custom', textureKey);
                                this._bgTexture = textureKey;
                            };
                            img.src = event.target.result;
                        };
                        reader.readAsDataURL(file);
                    }
                };
                input.click();
            } else {
                applyBg(val);
            }
        };
        bgSelect?.addEventListener('change', onBg);
        renderBg();

        const renderCats = () => {
            cats.innerHTML = '';
            for (const c of categories) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'chip';
                b.textContent = c.name;
                b.setAttribute('role', 'tab');
                b.setAttribute('aria-selected', c.key === state.category ? 'true' : 'false');
                b.addEventListener('click', () => {
                    state.category = c.key;
                    this.selectedCategory = c.key;
                    renderCats();
                    renderList();
                });
                cats.appendChild(b);
            }
        };

        const renderList = () => {
            const items = getItemsByCategory(state.category);
            const q = state.q.trim().toLowerCase();
            const filtered = q
                ? items.filter(it => (it.name || it.key).toLowerCase().includes(q) || it.key.toLowerCase().includes(q))
                : items;

            list.innerHTML = '';
            for (const it of filtered) {
                const row = document.createElement('div');
                row.className = 'furniture-item';
                row.setAttribute('role', 'listitem');
                row.tabIndex = 0;

                const emoji = document.createElement('div');
                emoji.className = 'furniture-emoji';
                emoji.textContent = '•';

                const main = document.createElement('div');
                const name = document.createElement('div');
                name.className = 'furniture-name';
                name.textContent = it.name || it.key;
                const meta = document.createElement('div');
                meta.className = 'furniture-meta';
                meta.textContent = it.key;
                main.appendChild(name);
                main.appendChild(meta);

                const pill = document.createElement('div');
                pill.className = 'pill';
                pill.textContent = 'Добавить';

                row.appendChild(emoji);
                row.appendChild(main);
                row.appendChild(pill);

                const onPick = () => {
                    this.exitPlacementMode();
                    this.selectItemForPlacement(it.key);
                    setOpen(false);
                };

                row.addEventListener('click', onPick);
                row.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onPick();
                    }
                });

                list.appendChild(row);
            }
        };

        const onToggle = () => setOpen(!state.open);
        toggle.addEventListener('click', onToggle);

        const onSearch = () => {
            state.q = search.value || '';
            renderList();
        };
        search.addEventListener('input', onSearch);

        // Snap toggle
        const syncSnapUi = () => {
            if (!snapToggle) return;
            snapToggle.setAttribute('aria-pressed', this.snapToGridEnabled ? 'true' : 'false');
            snapToggle.textContent = this.snapToGridEnabled ? 'Сетка: вкл' : 'Сетка: выкл';
        };
        const onSnap = () => {
            this.snapToGridEnabled = !this.snapToGridEnabled;
            this.drawGrid();
            syncSnapUi();
            this.showNotification(
                this.snapToGridEnabled ? 'Привязка к сетке: ВКЛ (G)' : 'Привязка к сетке: ВЫКЛ (G)',
                this.snapToGridEnabled ? '#4ecca3' : '#888888'
            );
        };
        snapToggle?.addEventListener('click', onSnap);
        syncSnapUi();

        // Delete selected
        const onDelete = () => {
            this.deleteSelectedItem();
        };
        deleteBtn?.addEventListener('click', onDelete);

        // Первичная отрисовка
        renderCats();
        renderList();

        // Очистка
        this._disposables.add(() => {
            try { toggle.removeEventListener('click', onToggle); } catch { /* noop */ }
            try { search.removeEventListener('input', onSearch); } catch { /* noop */ }
            try { snapToggle?.removeEventListener('click', onSnap); } catch { /* noop */ }
            try { deleteBtn?.removeEventListener('click', onDelete); } catch { /* noop */ }
            try { roomSelect?.removeEventListener('change', onRoomChange); } catch { /* noop */ }
            try { roomNew?.removeEventListener('click', onRoomNew); } catch { /* noop */ }
            try { bgSelect?.removeEventListener('change', onBg); } catch { /* noop */ }
        });
    }

    getPointerWorld(pointer) {
        const cam = this.cameras.main;
        const p = cam.getWorldPoint(pointer.x, pointer.y);
        return { x: p.x, y: p.y };
    }

    snapToGrid(x, y) {
        const gridX = Math.floor(x / this.gridSize) * this.gridSize + this.gridSize / 2;
        const gridY = Math.floor(y / this.gridSize) * this.gridSize + this.gridSize / 2;
        return { x: gridX, y: gridY };
    }

    getWorldBoundsPadding(pad = 50) {
        const cam = this.cameras.main;
        return {
            minX: cam.worldView.x + pad,
            minY: cam.worldView.y + pad,
            maxX: cam.worldView.x + cam.worldView.width - pad,
            maxY: cam.worldView.y + cam.worldView.height - pad
        };
    }
    
    setupCameraControls() {
        // Масштабирование колесиком мыши
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            if (!this.placementMode && !this.taskMode) {
                let newZoom = this.cameraZoom - deltaY * 0.05;
                newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, newZoom));
                this.cameraZoom = newZoom;
                this.cameras.main.setZoom(this.cameraZoom);
                this.drawGrid();
            }
        });

        // Перемещение камеры
        let isPanning = false;
        let panStart = { x: 0, y: 0 };
        
        this.input.on('pointerdown', (pointer) => {
            if (pointer.middleButtonDown() || (pointer.ctrlKey && pointer.leftButtonDown())) {
                isPanning = true;
                panStart.x = pointer.worldX;
                panStart.y = pointer.worldY;
                pointer.event.preventDefault();
            }
        });
        
        this.input.on('pointermove', (pointer) => {
            if (isPanning) {
                const deltaX = pointer.worldX - panStart.x;
                const deltaY = pointer.worldY - panStart.y;
                this.cameras.main.scrollX -= deltaX;
                this.cameras.main.scrollY -= deltaY;
                panStart.x = pointer.worldX;
                panStart.y = pointer.worldY;
                this.drawGrid();
            }
        });
        
        this.input.on('pointerup', () => {
            isPanning = false;
        });
    }
    
    setupCellHighlight() {
        this.cellHighlight = this.add.rectangle(0, 0, this.gridSize, this.gridSize, 0x4ecca3, 0.3)
            .setOrigin(0.5)
            .setDepth(1)
            .setVisible(false);
        
        this.input.on('pointermove', (pointer) => {
            if (!this.placementMode && !this.taskMode && this.snapToGridEnabled) {
                const camera = this.cameras.main;
                const worldX = pointer.x + camera.scrollX;
                const worldY = pointer.y + camera.scrollY;
                
                const gridX = Math.floor(worldX / this.gridSize) * this.gridSize + this.gridSize/2;
                const gridY = Math.floor(worldY / this.gridSize) * this.gridSize + this.gridSize/2;
                
                const maxX = camera.width - this.gridSize/2;
                const maxY = camera.height - this.gridSize/2;
                const finalX = Math.min(maxX, Math.max(this.gridSize/2, gridX));
                const finalY = Math.min(maxY, Math.max(this.gridSize/2, gridY));
                
                this.cellHighlight.setPosition(finalX, finalY);
                this.cellHighlight.setVisible(true);
            } else {
                this.cellHighlight.setVisible(false);
            }
        });
        
        this.input.on('pointerout', () => {
            this.cellHighlight.setVisible(false);
        });
    }
    
    selectItemForPlacement(key) {
        const itemData = furnitureData[key];
        console.log(`selectItemForPlacement: ${key}`, itemData);
        if (!itemData) {
            console.error(`Предмет ${key} не найден`);
            return;
        }

        // Убедимся, что нужная категория загружена
        loadCategoryFurniture(this, itemData.category)
            .then(() => {
                this.showRotationSelector(key, itemData);
                console.log(`Текстуры категории ${itemData.category} загружены`);
            })
            .catch((error) => {
                console.warn(`Не удалось загрузить категорию ${itemData.category}:`, error);
                this.showRotationSelector(key, itemData);
            });
    }
    
    showRotationSelector(itemKey, itemData) {
        const { width, height } = this.cameras.main;
        
        const modalElements = [];
        
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0, 0)
            .setDepth(2000)
            .setInteractive();
        modalElements.push(bg);
        
        const rotations = itemData.rotations || ['NE', 'NW', 'SE', 'SW'];
        const rotationsCount = rotations.length;
        const cols = Math.min(4, rotationsCount);
        const rows = Math.ceil(rotationsCount / cols);
        
        const cardWidth = 100;
        const cardHeight = 120;
        const windowWidth = Math.min(600, cols * cardWidth + 60);
        const windowHeight = rows * cardHeight + 100;
        
        const modal = this.add.rectangle(width/2, height/2, windowWidth, windowHeight, 0x232931)
            .setStrokeStyle(2, 0x4ecca3)
            .setDepth(2001);
        modalElements.push(modal);
        
        const title = this.add.text(width/2, height/2 - windowHeight/2 + 25, `Выберите ракурс для ${itemData.name}`, {
            fontSize: '18px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(2001);
        modalElements.push(title);
        
        const rotationNames = {
            'NE': '↗️ СЕВЕРО-ВОСТОК',
            'NW': '↖️ СЕВЕРО-ЗАПАД',
            'SE': '↘️ ЮГО-ВОСТОК',
            'SW': '↙️ ЮГО-ЗАПАД'
        };
        
        const startX = width/2 - (cols * cardWidth)/2 + cardWidth/2;
        const startY = height/2 - (rows * cardHeight)/2 + cardHeight/2;
        
        rotations.forEach((rotation, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = startX + (col * cardWidth);
            const y = startY + (row * cardHeight);
            const textureKey = `${itemKey}_${rotation}`;
            
            const cardBg = this.add.rectangle(x, y, cardWidth - 10, cardHeight - 10, 0x16213e)
                .setStrokeStyle(2, 0x4ecca3)
                .setInteractive({ useHandCursor: true })
                .setDepth(2001);
            modalElements.push(cardBg);
            
            let icon;
            if (this.textures.exists(textureKey)) {
                icon = this.add.image(x, y - 15, textureKey).setScale(0.35).setDepth(2001);
            } else {
                icon = this.add.text(x, y - 15, '[]', {
                    fontSize: '40px'
                }).setOrigin(0.5).setDepth(2001);
                
                loadSingleTexture(this, itemKey, rotation).then(() => {
                    if (icon && !icon.destroyed && this.textures.exists(textureKey)) {
                        icon.destroy();
                        const newIcon = this.add.image(x, y - 15, textureKey).setScale(0.35).setDepth(2001);
                        modalElements.push(newIcon);
                    }
                });
            }
            if (icon) modalElements.push(icon);
            
            const rotName = this.add.text(x, y + 20, rotationNames[rotation] || rotation, {
                fontSize: '10px',
                fill: '#ffffff'
            }).setOrigin(0.5).setDepth(2001);
            modalElements.push(rotName);
            
            const selectBtn = this.add.text(x, y + 45, 'Выбрать', {
                fontSize: '12px',
                fill: '#ffffff',
                backgroundColor: '#4ecca3',
                padding: { x: 12, y: 4 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(2001);
            modalElements.push(selectBtn);
            
            selectBtn.on('pointerdown', () => {
                this.selectedItem = itemKey;
                this.selectedRotation = rotation;
                this.placementMode = true;
                this.taskMode = false;
                
                if (this.previewItem) this.previewItem.destroy();
                
                if (this.textures.exists(textureKey)) {
                    this.previewItem = this.add.image(0, 0, textureKey)
                        .setScale(0.5)
                        .setAlpha(0.7)
                        .setDepth(1000);
                } else {
                    this.previewItem = this.add.rectangle(0, 0, 50, 50, 0x4ecca3)
                        .setAlpha(0.7)
                        .setDepth(1000);
                }
                
                modalElements.forEach(el => {
                    if (el && !el.destroyed) el.destroy();
                });
                
                this.showNotification(`Выбран: ${itemData.name} (${rotationNames[rotation] || rotation})`, '#4ecca3');
                this.createInstruction(true);
            });
        });
        
        const closeBtn = this.add.text(width/2, height/2 + windowHeight/2 - 25, 'Закрыть', {
            fontSize: '14px',
            fill: '#ffffff',
            backgroundColor: '#e94560',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(2001);
        modalElements.push(closeBtn);
        
        closeBtn.on('pointerdown', () => {
            modalElements.forEach(el => {
                if (el && !el.destroyed) el.destroy();
            });
        });
    }
    
    createBonusPanel() {
        const { width, height } = this.cameras.main;
        
        const saveBtnX = width - 210;
        const saveBtnWidth = 95;
        const loadBtnWidth = 95;
        
        const leftEdge = saveBtnX - saveBtnWidth/2;
        const rightEdge = saveBtnX + loadBtnWidth/2;
        const centerX = (leftEdge + rightEdge) / 2;
        const bonusY = 30 + 35 + 15;
        
        if (!this.currentUser) {
            this.bonusPanel = this.add.rectangle(centerX, bonusY, 140, 45, 0x232931)
                .setStrokeStyle(2, 0xffd700)
                .setOrigin(0.5);
            
            this.add.text(centerX - 55, bonusY, '💰', {
                fontSize: '28px'
            }).setOrigin(0.5);
            
            this.bonusText = this.add.text(centerX, bonusY, `${this.bonuses.family}`, {
                fontSize: '28px',
                fill: '#ffd700',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            
            return;
        }
        
        const userBonuses = this.currentUser?.bonuses || 0;
        
        this.bonusPanel = this.add.rectangle(centerX, bonusY, 150, 65, 0x232931)
            .setStrokeStyle(2, 0xffd700)
            .setOrigin(0.5);
        
        this.add.text(centerX - 60, bonusY - 8, '💰', {
            fontSize: '28px'
        }).setOrigin(0.5);
        
        this.bonusText = this.add.text(centerX, bonusY - 5, `${userBonuses}`, {
            fontSize: '28px',
            fill: '#ffd700',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        this.add.text(centerX, bonusY + 22, `Семья: ${this.bonuses.family}`, {
            fontSize: '11px',
            fill: '#aaaaaa'
        }).setOrigin(0.5);
    }
    
    updateBonusPanel() {
        if (!this.bonusText || !this.currentUser) return;
        
        this.bonusText.setText(`${this.currentUser.bonuses || 0}`);
        
        this.tweens.add({
            targets: this.bonusText,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 200,
            yoyo: true
        });
    }
    
    async placeItem(pointer) {
        if (!this.selectedItem || !this.selectedRotation) {
            console.log('Сначала выберите предмет и ракурс');
            return;
        }
        
        const data = furnitureData[this.selectedItem];
        const camera = this.cameras.main;
        const textureKey = `${this.selectedItem}_${this.selectedRotation}`;

        if (!this.textures.exists(textureKey)) {
            console.warn(`Текстура ${textureKey} не найдена, пробуем загрузить`);
            try {
                await loadSingleTexture(this, this.selectedItem, this.selectedRotation);
            } catch (error) {
                console.error(`Не удалось загрузить текстуру ${textureKey}:`, error);
            }
        }
        
        const { x: worldX, y: worldY } = this.getPointerWorld(pointer);
        
        const target = this.snapToGridEnabled ? this.snapToGrid(worldX, worldY) : { x: worldX, y: worldY };
        const gridX = target.x;
        const gridY = target.y;

        const { minX, minY, maxX, maxY } = this.getWorldBoundsPadding(50);
        
        const finalX = Math.min(maxX, Math.max(minX, gridX));
        const finalY = Math.min(maxY, Math.max(minY, gridY));
        
        if (!this.canPlaceItemAt(this.selectedItem, this.selectedRotation, finalX, finalY, null)) {
            this.showNotification('Нельзя разместить — пересечение', '#e94560');
            return;
        }
        
        let item;
        if (this.textures.exists(textureKey)) {
            item = this.add.image(finalX, finalY, textureKey);
        } else {
            console.warn(`Текстура ${textureKey} отсутствует, используем плейсхолдер`);
            item = this.add.rectangle(finalX, finalY, 50, 50, 0x4ecca3);
        }
        
        item.setScale(0.5);
        item.setInteractive({ 
            useHandCursor: true, 
            draggable: true,
            cursor: 'grab'
        });
        item.setDepth(finalY);
        
        const rotations = ['NE', 'NW', 'SE', 'SW'];
        item.data = {
            key: this.selectedItem,
            rotation: this.selectedRotation,
            rotationIndex: rotations.indexOf(this.selectedRotation),
            rotations: rotations,
            tasks: [],
            scale: 0.5
        };
        
        this.input.setDraggable(item);
        
        item.on('dragstart', (dragPointer) => {
            item.setDepth(1000);
            const wp = this.getPointerWorld(dragPointer);
            item.__dragOffset = { x: item.x - wp.x, y: item.y - wp.y };
        });
        
        item.on('drag', (dragPointer, dragX, dragY) => {
            const wp = this.getPointerWorld(dragPointer);
            const offset = item.__dragOffset || { x: 0, y: 0 };
            const targetX = wp.x + offset.x;
            const targetY = wp.y + offset.y;

            const { minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY } = this.getWorldBoundsPadding(50);
            const snapped = this.snapToGridEnabled ? this.snapToGrid(targetX, targetY) : { x: targetX, y: targetY };
            const snapX = snapped.x;
            const snapY = snapped.y;

            const nx = Math.min(bMaxX, Math.max(bMinX, snapX));
            const ny = Math.min(bMaxY, Math.max(bMinY, snapY));
            const ok = this.canPlaceItemAt(item.data.key, item.data.rotation, nx, ny, item);
            item.setAlpha(ok ? 1 : 0.6);
            item.setTint(ok ? 0xffffff : 0xff6666);
            this.drawDragFeedback(item.data.key, item.data.rotation, nx, ny, ok);

            item.x = nx;
            item.y = ny;
            item.setDepth(item.y);
            if (ok) item.__lastValidPos = { x: nx, y: ny };
            this.updateTaskMarkerPosition(item);
            if (this.selectedFurniture === item) this.updateSelectionOutline();
            this.sortItemsByDepth();
        });
        
        item.on('dragend', () => {
            this.clearDragFeedback();
            if (this.snapToGridEnabled) {
                const snapped = this.snapToGrid(item.x, item.y);
                item.setPosition(snapped.x, snapped.y);
            }
            const ok = this.canPlaceItemAt(item.data.key, item.data.rotation, item.x, item.y, item);
            if (!ok && item.__lastValidPos) {
                item.setPosition(item.__lastValidPos.x, item.__lastValidPos.y);
                this.showNotification('Место занято — откат', '#e94560');
            }
            item.clearTint();
            item.setAlpha(1);
            item.setDepth(item.y);
            delete item.__dragOffset;
            this.updateTaskMarkerPosition(item);
            if (this.selectedFurniture === item) this.updateSelectionOutline();
            this.sortItemsByDepth();

            this.markDirty();
        });
        
        item.on('pointerdown', (itemPointer, localX, localY, event) => {
            if (itemPointer.rightButtonDown()) {
                event.stopPropagation();
                this.rotateItem(item);
            } else if (!this.placementMode && !this.taskMode) {
                this.selectItem(item);
            }
        });
        
        this.items.push(item);
        this.sortItemsByDepth();
        
        this.selectedItem = null;
        this.selectedRotation = null;
        this.placementMode = false;
        
        if (this.previewItem) {
            this.previewItem.destroy();
            this.previewItem = null;
        }
        
        this.createInstruction();
        this.showNotification(`${data?.name || this.selectedItem} размещен!`, '#4ecca3');
        this.markDirty();
    }
    
    scaleItem(item, delta) {
        if (!item) return;
        
        let newScale = (item.scaleX || 0.5) + delta;
        newScale = Math.min(1.5, Math.max(0.3, newScale));
        
        this.tweens.add({
            targets: item,
            scaleX: newScale,
            scaleY: newScale,
            duration: 100,
            ease: 'Power2',
            onComplete: () => {
                if (item.data) item.data.scale = newScale;
                this.updateTaskMarkerPosition(item);
                if (this.selectedFurniture === item) this.updateSelectionOutline();
                this.markDirty();
                this.showNotification(`Масштаб: ${Math.round(newScale * 100)}%`, '#4ecca3');
            }
        });
    }
    
    rotateItem(item) {
        if (!item.data) return;
        
        const rotations = item.data.rotations;
        let newIndex = (item.data.rotationIndex + 1) % rotations.length;
        const newRotation = rotations[newIndex];
        
        const textureKey = `${item.data.key}_${newRotation}`;
        if (this.textures.exists(textureKey)) {
            if (typeof item.setTexture === 'function') item.setTexture(textureKey);
            item.data.rotation = newRotation;
            item.data.rotationIndex = newIndex;
            
            const currentScale = item.data.scale || item.scaleX || 0.5;
            item.setScale(currentScale);

            this.tweens.add({
                targets: item,
                scaleX: currentScale * 1.1,
                scaleY: currentScale * 1.1,
                duration: 100,
                yoyo: true
            });
            
            const directions = {
                'NE': '↗️ СЕВЕРО-ВОСТОК',
                'NW': '↖️ СЕВЕРО-ЗАПАД',
                'SE': '↘️ ЮГО-ВОСТОК',
                'SW': '↙️ ЮГО-ЗАПАД'
            };
            
            const text = this.add.text(item.x, item.y - 50, directions[newRotation], {
                fontSize: '12px',
                fill: '#ffffff',
                backgroundColor: '#e94560',
                padding: { x: 5, y: 2 }
            }).setOrigin(0.5);
            
            this.time.delayedCall(1000, () => text.destroy());
            this.updateTaskMarkerPosition(item);
            if (this.selectedFurniture === item) this.updateSelectionOutline();
            this.markDirty();
        }
    }
    
    selectItem(item) {
        this.deselectItem();
        this.selectedFurniture = item;
        this.updateSelectionOutline();
    }
    
    deselectItem() {
        if (this.selectedFurniture) {
            this.selectedFurniture = null;
        }
        this.updateSelectionOutline();
    }
    
    deleteSelectedItem() {
        if (this.selectedFurniture) {
            const index = this.items.indexOf(this.selectedFurniture);
            if (index > -1) {
                this.items.splice(index, 1);
            }
            if (this.selectedFurniture.taskMarker) {
                if (this.selectedFurniture.taskMarker.marker) this.selectedFurniture.taskMarker.marker.destroy();
                if (this.selectedFurniture.taskMarker.text) this.selectedFurniture.taskMarker.text.destroy();
                this.selectedFurniture.taskMarker = null;
            }
            this.selectedFurniture.destroy();
            this.selectedFurniture = null;
            console.log('Предмет удален');
            this.sortItemsByDepth();
            this.updateSelectionOutline();
            this.markDirty();
            this.showNotification('Предмет удалён', '#e94560');
        }
    }

    getFootprint(itemKey, rotation, x, y) {
        const def = furnitureData[itemKey];
        const size = def?.size || [1, 1];
        let w = size[0];
        let h = size[1];
        const idx = ['NE', 'NW', 'SE', 'SW'].indexOf(rotation);
        if (idx === 1 || idx === 3) {
            [w, h] = [h, w];
        }
        const pxW = w * this.gridSize;
        const pxH = h * this.gridSize;
        return new Phaser.Geom.Rectangle(x - pxW / 2, y - pxH / 2, pxW, pxH);
    }

    canPlaceItemAt(itemKey, rotation, x, y, self) {
        const fp = this.getFootprint(itemKey, rotation, x, y);
        return !this.items.some(it => {
            if (!it || it.destroyed) return false;
            if (self && it === self) return false;
            const other = this.getFootprint(it.data?.key, it.data?.rotation, it.x, it.y);
            return Phaser.Geom.Intersects.RectangleToRectangle(fp, other);
        });
    }
    
    exitPlacementMode() {
        this.placementMode = false;
        this.selectedItem = null;
        
        if (this.previewItem) {
            this.previewItem.destroy();
            this.previewItem = null;
        }
        
        this.createInstruction();
    }
    
    createTask(pointer) {
        if (!this.taskMode) {
            this.showNotification('Сначала нажмите кнопку "Задания"', '#ffd700');
            return;
        }
        
        const item = this.findItemAtPosition(pointer.x, pointer.y);
        
        if (!item) {
            this.showNotification('Кликните на предмет, чтобы создать задание', '#ffd700');
            return;
        }
        
        this.showItemTasks(item);
    }
    
    findItemAtPosition(x, y) {
        const camera = this.cameras.main;
        
        let worldX, worldY;
        if (x.worldX !== undefined) {
            worldX = x.worldX;
            worldY = x.worldY;
        } else {
            worldX = x + camera.scrollX;
            worldY = y + camera.scrollY;
        }
        
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const distance = Phaser.Math.Distance.Between(item.x, item.y, worldX, worldY);
            
            if (distance < 60) {
                return item;
            }
        }
        
        return null;
    }
    
    showItemTasks(item) {
        const { width, height } = this.cameras.main;
        const modalElements = [];
        
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0, 0).setDepth(2000).setInteractive();
        modalElements.push(bg);
        
        const modal = this.add.rectangle(width/2, height/2, 550, 450, 0x232931)
            .setStrokeStyle(2, 0x4ecca3).setDepth(2001);
        modalElements.push(modal);
        
        const itemData = furnitureData[item.data.key];
        const title = this.add.text(width/2, height/2 - 190, `Задания для ${itemData?.name || 'предмета'}`, {
            fontSize: '20px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(2001);
        modalElements.push(title);
        
        const createBtn = this.add.text(width/2, height/2 - 130, '+ Создать новое задание', {
            fontSize: '14px', fill: '#ffffff', backgroundColor: '#4ecca3',
            padding: { x: 15, y: 8 }
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(2001)
        .on('pointerdown', () => {
            modalElements.forEach(el => el.destroy());
            this.createTaskModal(item, itemData);
        });
        modalElements.push(createBtn);
        
        const line = this.add.rectangle(width/2 - 250, height/2 - 100, 500, 2, 0x4ecca3, 0.5)
            .setOrigin(0, 0).setDepth(2001);
        modalElements.push(line);
        
        let y = height/2 - 70;
        
        if (item.data.tasks && item.data.tasks.length > 0) {
            this.add.text(width/2 - 240, y - 5, 'Активные задания:', {
                fontSize: '12px', fill: '#ffd700'
            }).setDepth(2001);
            
            item.data.tasks.forEach(task => {
                const taskBg = this.add.rectangle(width/2 - 230, y, 460, 55, 0x16213e)
                    .setStrokeStyle(1, task.status === 'completed' ? 0x4ecca3 : 0x666666)
                    .setDepth(2001);
                modalElements.push(taskBg);
                
                const statusIcon = task.status === 'completed' ? '✅' : '⏳';
                this.add.text(width/2 - 220, y + 10, statusIcon, {
                    fontSize: '16px'
                }).setDepth(2001);
                
                this.add.text(width/2 - 190, y + 8, task.title.length > 30 ? task.title.substring(0, 27) + '...' : task.title, {
                    fontSize: '12px', fill: '#ffffff'
                }).setDepth(2001);
                
                this.add.text(width/2 + 150, y + 8, `${task.bonus}💰`, {
                    fontSize: '12px', fill: '#ffd700'
                }).setDepth(2001);
                
                if (task.status !== 'completed') {
                    const completeBtn = this.add.text(width/2 + 190, y + 25, 'Выполнить', {
                        fontSize: '10px', fill: '#ffffff', backgroundColor: '#4ecca3',
                        padding: { x: 8, y: 3 }
                    })
                    .setInteractive({ useHandCursor: true })
                    .setDepth(2001)
                    .on('pointerdown', async () => {
                        await this.completeTask(task);
                        modalElements.forEach(el => el.destroy());
                        this.showItemTasks(item);
                    });
                    modalElements.push(completeBtn);
                } else {
                    this.add.text(width/2 + 190, y + 25, '✓ Выполнено', {
                        fontSize: '10px', fill: '#4ecca3'
                    }).setDepth(2001);
                }
                
                y += 65;
            });
        } else {
            this.add.text(width/2, height/2 - 30, 'Нет заданий для этого предмета', {
                fontSize: '14px', fill: '#aaaaaa'
            }).setOrigin(0.5).setDepth(2001);
            
            this.add.text(width/2, height/2 + 10, 'Нажмите "+ Создать новое задание"', {
                fontSize: '12px', fill: '#888888'
            }).setOrigin(0.5).setDepth(2001);
        }
        
        const closeBtn = this.add.text(width/2, height/2 + 170, 'Закрыть', {
            fontSize: '14px', fill: '#ffffff', backgroundColor: '#e94560',
            padding: { x: 25, y: 8 }
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(2001)
        .on('pointerdown', () => {
            modalElements.forEach(el => el.destroy());
        });
        modalElements.push(closeBtn);
    }
    
    createTaskModal(item, itemData) {
        const { width, height } = this.cameras.main;
        
        const modalElements = [];
        
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0, 0).setDepth(2000).setInteractive();
        modalElements.push(bg);
        
        const modal = this.add.rectangle(width/2, height/2, 500, 450, 0x232931)
            .setStrokeStyle(2, 0x4ecca3).setDepth(2001);
        modalElements.push(modal);
        
        const title = this.add.text(width/2, height/2 - 190, `Создать задание для ${itemData?.name || 'предмета'}`, {
            fontSize: '20px', fill: '#ffffff'
        }).setOrigin(0.5).setDepth(2001);
        modalElements.push(title);
        
        // Поле для названия
        this.add.text(width/2 - 200, height/2 - 120, 'Название:', {
            fontSize: '14px', fill: '#aaaaaa'
        }).setDepth(2001);
        
        const titleBg = this.add.rectangle(width/2, height/2 - 90, 350, 35, 0x16213e)
            .setStrokeStyle(1, 0x4ecca3).setDepth(2001);
        modalElements.push(titleBg);
        
        const titleInput = this.add.text(width/2 - 170, height/2 - 100, '', {
            fontSize: '14px', fill: '#ffffff'
        }).setDepth(2001);
        titleInput.inputValue = '';
        modalElements.push(titleInput);
        
        // Поле для бонусов
        this.add.text(width/2 - 200, height/2 - 30, 'Бонусы:', {
            fontSize: '14px', fill: '#aaaaaa'
        }).setDepth(2001);
        
        const bonusBg = this.add.rectangle(width/2, height/2 - 5, 150, 35, 0x16213e)
            .setStrokeStyle(1, 0x4ecca3).setDepth(2001);
        modalElements.push(bonusBg);
        
        const bonusText = this.add.text(width/2 - 70, height/2 - 15, '10', {
            fontSize: '16px', fill: '#ffd700'
        }).setDepth(2001);
        modalElements.push(bonusText);
        
        const minusBtn = this.add.text(width/2 + 40, height/2 - 15, '-', {
            fontSize: '20px', fill: '#ffffff', backgroundColor: '#e94560',
            padding: { x: 10, y: 5 }
        })
        .setInteractive({ useHandCursor: true }).setDepth(2001)
        .on('pointerdown', () => {
            let val = parseInt(bonusText.text) || 10;
            if (val > 1) bonusText.setText(`${val - 1}`);
        });
        modalElements.push(minusBtn);
        
        const plusBtn = this.add.text(width/2 + 80, height/2 - 15, '+', {
            fontSize: '20px', fill: '#ffffff', backgroundColor: '#4ecca3',
            padding: { x: 10, y: 5 }
        })
        .setInteractive({ useHandCursor: true }).setDepth(2001)
        .on('pointerdown', () => {
            let val = parseInt(bonusText.text) || 10;
            bonusText.setText(`${val + 1}`);
        });
        modalElements.push(plusBtn);
        
        // Поле выбора члена семьи
        this.add.text(width/2 - 200, height/2 + 50, 'Назначить:', {
            fontSize: '14px', fill: '#aaaaaa'
        }).setDepth(2001);
        
        const assignSelect = document.createElement('select');
        assignSelect.className = 'chip';
        assignSelect.style.background = '#16213e';
        assignSelect.style.color = '#fff';
        assignSelect.style.padding = '8px';
        assignSelect.style.borderRadius = '8px';
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '— Не назначено —';
        assignSelect.appendChild(defaultOption);
        
        // Загружаем членов семьи
        this.loadFamilyMembersForSelect(assignSelect);
        
        const assignContainer = this.add.dom(width/2 + 50, height/2 + 60, assignSelect);
        assignContainer.setDepth(2001);
        modalElements.push(assignContainer);
        
        // Активное поле ввода
        let activeInput = null;
        
        titleBg.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                activeInput = titleInput;
                titleBg.setStrokeStyle(3, 0xe94560);
                bonusBg.setStrokeStyle(1, 0x4ecca3);
            });
        
        // Кнопки
        const saveBtn = this.add.text(width/2 - 80, height/2 + 130, 'Сохранить', {
            fontSize: '16px', fill: '#ffffff', backgroundColor: '#4ecca3',
            padding: { x: 20, y: 10 }
        })
        .setInteractive({ useHandCursor: true }).setDepth(2001);
        modalElements.push(saveBtn);
        
        saveBtn.on('pointerdown', async () => {
            const taskText = titleInput.inputValue?.trim() || `Задание для ${itemData?.name || 'предмета'}`;
            const taskBonus = parseInt(bonusText.text) || 10;
            const assignedTo = assignSelect.value || null;
            
            try {
                const newTask = await api.createTask({
                    title: taskText,
                    description: `Задание для ${itemData?.name || 'предмета'}`,
                    bonus: taskBonus,
                    itemKey: item.data.key,
                    itemName: itemData?.name,
                    assignedTo: assignedTo
                });
                
                if (!item.data.tasks) item.data.tasks = [];
                item.data.tasks.push(newTask);
                
                this.updateTaskMarker(item);
                this.syncTasksWithGlobal();
                
                modalElements.forEach(el => el.destroy());
                this.showNotification(`Задание "${taskText}" создано! (+${taskBonus}💰)`, '#4ecca3');
                
            } catch (error) {
                console.error('Ошибка создания:', error);
                this.showNotification('Ошибка создания задания', '#e94560');
            }
        });
        
        const cancelBtn = this.add.text(width/2 + 80, height/2 + 130, 'Отмена', {
            fontSize: '16px', fill: '#ffffff', backgroundColor: '#e94560',
            padding: { x: 20, y: 10 }
        })
        .setInteractive({ useHandCursor: true }).setDepth(2001)
        .on('pointerdown', () => {
            modalElements.forEach(el => el.destroy());
        });
        modalElements.push(cancelBtn);
        
        // Обработка ввода
        const keyHandler = (event) => {
            if (!activeInput) return;
            
            const key = event.key;
            if (key === 'Backspace') {
                activeInput.inputValue = activeInput.inputValue.slice(0, -1);
            } else if (key === 'Enter') {
                activeInput = null;
                titleBg.setStrokeStyle(1, 0x4ecca3);
            } else if (key.length === 1 && !event.ctrlKey && !event.altKey) {
                activeInput.inputValue += key;
            }
            activeInput.setText(activeInput.inputValue);
        };
        
        this.input.keyboard.on('keydown', keyHandler);
        
        const updateHandler = () => {
            if (activeInput === titleInput) {
                titleInput.setText(titleInput.inputValue || '');
            }
        };
        
        this.events.on('update', updateHandler);
        
        modalElements.push({ destroy: () => {
            this.events.off('update', updateHandler);
            this.input.keyboard.off('keydown', keyHandler);
        }});
    }
    
    async loadFamilyMembersForSelect(selectElement) {
        try {
            const members = await api.getFamilyMembers();
            selectElement.innerHTML = '';
            
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '— Не назначено —';
            selectElement.appendChild(defaultOption);
            
            members.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = `${member.name} (${member.role === 'parent' ? 'Родитель' : 'Ребёнок'})`;
                selectElement.appendChild(option);
            });
        } catch (error) {
            console.error('Ошибка загрузки членов семьи:', error);
        }
    }
    
    async saveRoom() {
        if (!this.currentUser) {
            this.showNotification('Войдите в систему');
            return;
        }
        
        this.isLoading = true;
        this.loadingText.setVisible(true);
        
        try {
            const roomData = {
                name: this.roomName,
                data: {
                    meta: { bgKey: this._bgKey },
                    items: this.items.map(item => ({
                        key: item.data.key,
                        rotation: item.data.rotationIndex || 0,
                        x: item.x,
                        y: item.y,
                        scale: item.data.scale || item.scaleX || 0.5,
                        tasks: item.data.tasks || []
                    }))
                },
                width: 20,
                height: 15,
                gridSize: this.gridSize
            };
            console.log('Editor saveRoom payload:', roomData);
            
            const result = await api.saveRoom(roomData);
            console.log('Editor saveRoom response:', result);
            if (!result?.id) {
                throw new Error('Сервер не вернул id комнаты');
            }
            this.roomId = result.id;
            this._dirty = false;
            try {
                localStorage.setItem(`room_backup_${this.roomName}`, JSON.stringify(roomData));
            } catch {
                // ignore local fallback write errors
            }
            this.showNotification('Комната сохранена!', '#4ecca3');
            
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            this._dirty = true;
            try {
                const fallbackRoomData = {
                    name: this.roomName,
                    data: {
                        meta: { bgKey: this._bgKey },
                        items: this.items.map(item => ({
                            key: item.data.key,
                            rotation: item.data.rotationIndex || 0,
                            x: item.x,
                            y: item.y,
                            scale: item.data.scale || item.scaleX || 0.5,
                            tasks: item.data.tasks || []
                        }))
                    },
                    width: 20,
                    height: 15,
                    gridSize: this.gridSize
                };
                localStorage.setItem(`room_backup_${this.roomName}`, JSON.stringify(fallbackRoomData));
            } catch {
                // ignore local fallback write errors
            }
            this.showNotification('Ошибка сохранения', '#e94560');
            throw error;
        } finally {
            this.isLoading = false;
            this.loadingText.setVisible(false);
        }
    }
    
    async loadRoom() {
        if (!this.currentUser) {
            return;
        }
        
        this.isLoading = true;
        this.loadingText.setVisible(true);
        
        try {
            const room = await api.getRoom(this.roomName);
            
            if (!room) {
                const backup = localStorage.getItem(`room_backup_${this.roomName}`);
                if (backup) {
                    try {
                        const parsed = JSON.parse(backup);
                        const data = parsed?.data || {};
                        const roomLike = { id: null, data };
                        this.loadRoomFromData(roomLike);
                        this._dirty = false;
                        this.showNotification('Комната восстановлена из локальной копии', '#ffd700');
                        return;
                    } catch {
                        // continue to empty state
                    }
                }
                this.items.forEach(item => item.destroy());
                this.items = [];
                this._dirty = false;
                this.showNotification('Новая пустая комната', '#888888');
                return;
            }
            
            this.loadRoomFromData(room);
            
            this.roomId = room.id;
            this.sortItemsByDepth();
            this._dirty = false;
            this.showNotification('Комната загружена', '#4ecca3');
            
        } catch (error) {
            console.error('Ошибка загрузки:', error);
        } finally {
            this.isLoading = false;
            this.loadingText.setVisible(false);
        }
    }

    loadRoomFromData(room) {
        this.items.forEach(item => item.destroy());
        this.items = [];
        const rotations = ['NE', 'NW', 'SE', 'SW'];
        const data = room.data;
        const roomItems = Array.isArray(data) ? data : (data?.items || []);
        const meta = Array.isArray(data) ? {} : (data?.meta || {});
        if (meta.bgKey) this.applyBackgroundKey(meta.bgKey);

        for (const itemData of roomItems) {
            const rotationIndex = itemData.rotation || 0;
            const rotation = rotations[rotationIndex];
            const textureKey = `${itemData.key}_${rotation}`;
            const scale = itemData.scale ?? 0.5;
            let item;
            if (this.textures.exists(textureKey)) {
                item = this.add.image(itemData.x, itemData.y, textureKey);
            } else {
                item = this.add.rectangle(itemData.x, itemData.y, 50, 50, 0x4ecca3);
            }
            item.setScale(scale);
            item.setInteractive({ useHandCursor: true, draggable: true, cursor: 'grab' });
            item.setDepth(itemData.y);
            item.data = {
                key: itemData.key,
                rotation: rotation,
                rotationIndex: rotationIndex,
                rotations: rotations,
                tasks: itemData.tasks || [],
                scale: scale
            };
            this.input.setDraggable(item);
            item.on('dragstart', (dragPointer) => {
                item.setDepth(1000);
                const wp = this.getPointerWorld(dragPointer);
                item.__dragOffset = { x: item.x - wp.x, y: item.y - wp.y };
            });
            item.on('drag', (dragPointer) => {
                const wp = this.getPointerWorld(dragPointer);
                const offset = item.__dragOffset || { x: 0, y: 0 };
                const targetX = wp.x + offset.x;
                const targetY = wp.y + offset.y;
                const { minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY } = this.getWorldBoundsPadding(50);
                const snapped = this.snapToGridEnabled ? this.snapToGrid(targetX, targetY) : { x: targetX, y: targetY };
                item.x = Math.min(bMaxX, Math.max(bMinX, snapped.x));
                item.y = Math.min(bMaxY, Math.max(bMinY, snapped.y));
                const ok = this.canPlaceItemAt(item.data.key, item.data.rotation, item.x, item.y, item);
                item.setAlpha(ok ? 1 : 0.6);
                item.setTint(ok ? 0xffffff : 0xff6666);
                this.drawDragFeedback(item.data.key, item.data.rotation, item.x, item.y, ok);
                item.setDepth(item.y);
                item.__lastValidPos = { x: item.x, y: item.y };
                this.updateTaskMarkerPosition(item);
                if (this.selectedFurniture === item) this.updateSelectionOutline();
                this.sortItemsByDepth();
            });
            item.on('dragend', () => {
                this.clearDragFeedback();
                if (this.snapToGridEnabled) {
                    const snapped = this.snapToGrid(item.x, item.y);
                    item.setPosition(snapped.x, snapped.y);
                }
                item.setDepth(item.y);
                delete item.__dragOffset;
                this.updateTaskMarkerPosition(item);
                if (this.selectedFurniture === item) this.updateSelectionOutline();
                this.sortItemsByDepth();
                this.markDirty();
            });
            item.on('pointerdown', (itemPointer, localX, localY, event) => {
                if (itemPointer.rightButtonDown()) {
                    event.stopPropagation();
                    this.rotateItem(item);
                } else if (!this.placementMode && !this.taskMode) {
                    this.selectItem(item);
                }
            });
            this.items.push(item);
            this.updateTaskMarker(item);
        }
    }

    applyBackgroundKey(key) {
        const map = {
            sky: 0x7faee1,
            night: 0x0f0f1a,
            sand: 0xd9c7a6,
            mint: 0x7bdcb5,
            lavender: 0xb8a1ff
        };
        this._bgKey = key in map ? key : 'sky';
        if (this._bgRect) this._bgRect.setFillStyle(map[this._bgKey] || 0x7faee1);
        if (this._bgSprite) {
            this._bgSprite.destroy();
            this._bgSprite = null;
        }
    }

    markDirty() {
        if (!this.currentUser) return;
        this._dirty = true;
        if (this._autosaveTimer) {
            try { this._autosaveTimer.remove(false); } catch { /* noop */ }
        }
        this._autosaveTimer = this.time.delayedCall(800, () => this.autosaveNow());
    }

    async autosaveNow() {
        if (!this._dirty) return;
        try {
            await this.saveRoom();
        } catch {
            // saveRoom already notifies on errors
        }
    }

    async forceSaveBeforeExit() {
        if (!this._dirty) return;
        try {
            await this.saveRoom();
        } catch {
            // keep unsaved warning behavior
        }
    }

    async switchRoom(newRoomName, refreshRoomsCb = null) {
        if (!newRoomName || newRoomName === this.roomName) return;
        if (this._dirty) await this.saveRoom();
        this.items.forEach(item => item.destroy());
        this.items = [];
        this.selectedFurniture = null;
        this.updateSelectionOutline();
        this.roomName = newRoomName;
        await this.loadRoom();
        await this.loadTasksFromServer();
        this.refreshAllItems();
        this.sortItemsByDepth();
        if (typeof refreshRoomsCb === 'function') await refreshRoomsCb();
        this.showNotification(`Комната: ${newRoomName}`, '#4ecca3');
    }

    sortItemsByDepth() {
        this.items.sort((a, b) => a.y - b.y);
        this.items.forEach(item => {
            if (item && !item.destroyed) item.setDepth(item.y);
        });
    }
    
    updateTaskMarker(item) {
        if (item.taskMarker) {
            if (item.taskMarker.marker) item.taskMarker.marker.destroy();
            if (item.taskMarker.text) item.taskMarker.text.destroy();
            item.taskMarker = null;
        }
        
        const count = item.data.tasks?.length || 0;
        if (count === 0) return;
        
        const marker = this.add.circle(item.x, item.y - 30, 12, 0xe94560)
            .setStrokeStyle(2, 0xffffff)
            .setDepth(2000);
        
        const text = this.add.text(item.x, item.y - 30, `${count}`, {
            fontSize: '12px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setDepth(2001).setOrigin(0.5);
        
        item.taskMarker = { marker, text };
    }

    updateTaskMarkerPosition(item) {
        if (!item?.taskMarker) return;
        const { marker, text } = item.taskMarker;
        if (marker && !marker.destroyed) marker.setPosition(item.x, item.y - 30);
        if (text && !text.destroyed) text.setPosition(item.x, item.y - 30);
        if (marker && !marker.destroyed) marker.setDepth(item.depth + 1000);
        if (text && !text.destroyed) text.setDepth(item.depth + 1001);
    }
    
    syncTasksWithGlobal() {
        const allTasks = [];
        this.items.forEach(item => {
            if (item.data.tasks && item.data.tasks.length > 0) {
                allTasks.push(...item.data.tasks);
            }
        });
        
        localStorage.setItem('homespace_tasks_sync', JSON.stringify({
            tasks: allTasks,
            lastSync: Date.now(),
            itemTasks: this.items.map(item => ({
                itemKey: item.data.key,
                tasks: item.data.tasks || []
            }))
        }));
    }
    
    async loadTasksFromServer() {
        try {
            const allServerTasks = await api.getTasks({});
            
            this.items.forEach(item => {
                const itemTasks = allServerTasks.filter(task => 
                    task.item_key === item.data.key && task.status !== 'completed'
                );
                item.data.tasks = itemTasks;
                this.updateTaskMarker(item);
            });
            
            this.syncTasksWithGlobal();
        } catch (error) {
            console.error('Ошибка загрузки заданий с сервера:', error);
        }
    }
    
    checkTasksSync() {
        const syncData = localStorage.getItem('homespace_tasks_sync');
        if (syncData) {
            try {
                const data = JSON.parse(syncData);
                if (data.itemTasks) {
                    data.itemTasks.forEach(itemSync => {
                        const item = this.items.find(i => i.data.key === itemSync.itemKey);
                        if (item) {
                            item.data.tasks = itemSync.tasks;
                            this.updateTaskMarker(item);
                        }
                    });
                }
            } catch (e) {
                console.error('Ошибка чтения синхронизации:', e);
            }
        }
    }
    
    async completeTask(task) {
        try {
            const result = await api.completeTask(task.id);
            
            if (this.currentUser) {
                this.currentUser.bonuses = (this.currentUser.bonuses || 0) + task.bonus;
                localStorage.setItem('homespace_currentUser', JSON.stringify(this.currentUser));
                this.updateBonusPanel();
            }
            
            this.showNotification(`+${task.bonus} бонусов!`, '#ffd700');
            
            for (const item of this.items) {
                if (item.data.tasks) {
                    const taskIndex = item.data.tasks.findIndex(t => t.id === task.id);
                    if (taskIndex !== -1) {
                        item.data.tasks.splice(taskIndex, 1);
                        this.updateTaskMarker(item);
                        break;
                    }
                }
            }
            
            this.syncTasksWithGlobal();
            
        } catch (error) {
            console.error('Ошибка выполнения задания:', error);
            this.showNotification('Ошибка выполнения', '#e94560');
        }
    }
    
    showBonusHistory() {
        const { width, height } = this.cameras.main;
        const windowElements = [];
        
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setOrigin(0, 0)
            .setDepth(3000)
            .setInteractive();
        windowElements.push(bg);
        
        const windowBg = this.add.rectangle(width/2, height/2, 600, 500, 0x232931)
            .setStrokeStyle(2, 0xffd700)
            .setDepth(3001);
        windowElements.push(windowBg);
        
        const title = this.add.text(width/2, height/2 - 220, 'История бонусов', {
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5).setDepth(3001);
        windowElements.push(title);
        
        const closeBtn = this.add.text(width/2 + 280, height/2 - 230, '✕', {
            fontSize: '24px',
            fill: '#ffffff',
            backgroundColor: '#e94560',
            padding: { x: 8, y: 4 }
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(3001)
        .setOrigin(0.5);
        
        closeBtn.on('pointerdown', () => {
            windowElements.forEach(el => {
                if (el && !el.destroyed) el.destroy();
            });
        });
        windowElements.push(closeBtn);
        
        let y = height/2 - 170;
        const history = this.bonuses.history.slice(-20).reverse();
        
        history.forEach(entry => {
            const color = entry.type === 'completion' ? '#4ecca3' : '#e94560';
            
            const dateText = this.add.text(width/2 - 250, y, entry.date, {
                fontSize: '12px',
                fill: '#aaaaaa'
            }).setDepth(3001);
            windowElements.push(dateText);
            
            const taskText = this.add.text(width/2 - 250, y + 15, `${entry.task.substring(0, 30)}...`, {
                fontSize: '14px',
                fill: '#ffffff'
            }).setDepth(3001);
            windowElements.push(taskText);
            
            const bonusText = this.add.text(width/2 + 200, y + 15, `${entry.bonus} бонусов`, {
                fontSize: '16px',
                fill: color,
                fontStyle: 'bold'
            }).setDepth(3001);
            windowElements.push(bonusText);
            
            y += 50;
        });
        
        bg.on('pointerdown', () => {
            windowElements.forEach(el => {
                if (el && !el.destroyed) el.destroy();
            });
        });
    }
    
    saveBonuses() {
        localStorage.setItem('homespace_bonuses', JSON.stringify(this.bonuses));
    }
    
    loadBonuses() {
        const saved = localStorage.getItem('homespace_bonuses');
        if (saved) {
            try {
                this.bonuses = JSON.parse(saved);
            } catch (e) {
                console.error('Ошибка загрузки бонусов:', e);
            }
        }
    }
    
    loadCurrentUser() {
        this.currentUser = api.getCurrentUser();
        this.isAdmin = this.currentUser?.role === 'parent' || this.currentUser?.role === 'admin';

        if (this.currentUser && !this.currentUser.familyCode && this.currentUser.familyInviteCode) {
            this.currentUser.familyCode = this.currentUser.familyInviteCode;
        }
    }
    
    createInstruction(placementMode = false) {
        const { width, height } = this.cameras.main;
        
        if (this.instruction) {
            this.instruction.destroy();
        }
        
        let text = 'ЛКМ - выделить | ПКМ - повернуть | DEL - удалить';
        text += ' | Q/E - масштаб | R - повернуть | Колесико - масштаб камеры | Ctrl+ЛКМ - перемещение';
        text += ' | G - вкл/выкл сетку';
        
        if (this.taskMode) {
            text = 'РЕЖИМ ЗАДАНИЙ: Клик по предмету - управление заданиями | ESC - выйти';
        } else if (placementMode) {
            text = 'РЕЖИМ РАЗМЕЩЕНИЯ: Клик по сетке - разместить | ESC - отмена';
        }
        
        this.instruction = this.add.text(width/2, height - 25, text, {
            fontSize: '11px',
            fill: this.taskMode ? '#4ecca3' : (placementMode ? '#4ecca3' : '#888888'),
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setDepth(1000);
    }
    
    showNotification(text, color = '#4ecca3') {
        const type =
            color === '#e94560' ? 'error' :
            color === '#ffd700' ? 'warning' :
            color === '#4ecca3' ? 'success' :
            'info';
        this._notifier?.show(text, type, { color });
    }
    
    refreshAllItems() {
        console.log('Обновление всех предметов...');
        const camera = this.cameras.main;
        const minX = 50;
        const minY = 50;
        const maxX = camera.width - 50;
        const maxY = camera.height - 50;
        
        this.items.forEach((item, index) => {
            if (item.x < minX || item.x > maxX || item.y < minY || item.y > maxY) {
                console.log(`Предмет ${index} за пределами, перемещаем в центр`);
                item.x = camera.width / 2;
                item.y = camera.height / 2;
            }
            
            item.setDepth(item.y);
            this.updateTaskMarkerPosition(item);
            
            if (item.input) {
                item.input.enabled = true;
                item.input.draggable = true;
            }
        });
    }

    updateSelectionOutline() {
        if (!this.selectionGraphics) return;
        this.selectionGraphics.clear();

        const item = this.selectedFurniture;
        if (!item || item.destroyed) return;

        const bounds = item.getBounds ? item.getBounds() : null;
        if (!bounds) return;

        this.selectionGraphics.fillStyle(0x4ecca3, 0.2);
        this.selectionGraphics.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        this.selectionGraphics.lineStyle(3, 0x4ecca3, 1);
        this.selectionGraphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    drawDragFeedback(itemKey, rotation, x, y, ok) {
        if (!this.dragFeedbackGraphics) return;
        this.dragFeedbackGraphics.clear();
        const fp = this.getFootprint(itemKey, rotation, x, y);
        this.dragFeedbackGraphics.fillStyle(ok ? 0x4ecca3 : 0xe94560, 0.18);
        this.dragFeedbackGraphics.fillRect(fp.x, fp.y, fp.width, fp.height);
        this.dragFeedbackGraphics.lineStyle(2, ok ? 0x4ecca3 : 0xe94560, 1);
        this.dragFeedbackGraphics.strokeRect(fp.x, fp.y, fp.width, fp.height);
    }

    clearDragFeedback() {
        if (!this.dragFeedbackGraphics) return;
        this.dragFeedbackGraphics.clear();
    }
    
    debugPlaceItem(key = 'shower', rotation = 'NE') {
        console.log('debugPlaceItem', key, rotation);

        if (!furnitureData[key]) {
            console.warn(`debugPlaceItem: предмет ${key} не найден в furnitureData`);
            return;
        }

        const scene = this;
        const camera = scene.cameras.main;
        const centerX = camera.worldView.centerX;
        const centerY = camera.worldView.centerY;

        this.selectedItem = key;
        this.selectedRotation = rotation;
        this.placementMode = false;

        if (!this.textures.exists(`${key}_${rotation}`)) {
            loadSingleTexture(this, key, rotation)
                .then(() => {
                    console.log(`debugPlaceItem: загружена ${key}_${rotation}`);
                    this.placeItem({ x: centerX - camera.scrollX, y: centerY - camera.scrollY });
                }).catch((err) => {
                    console.error('debugPlaceItem: ошибка загрузки', err);
                    this.placeItem({ x: centerX - camera.scrollX, y: centerY - camera.scrollY });
                });
        } else {
            this.placeItem({ x: centerX - camera.scrollX, y: centerY - camera.scrollY });
        }
    }

    destroy() {
        this._disposables.run();
        super.destroy();
    }
}