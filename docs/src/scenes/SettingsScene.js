// src/scenes/SettingsScene.js
// Профиль пользователя и настройки приложения
import { createRoundedTextButton } from '../utils/ui.js';
import { api } from '../services/api.js';
import { createDisposables, createNotificationManager } from '../utils/sceneUi.js';

export class SettingsScene extends Phaser.Scene {
    constructor() {
        super('SettingsScene');
        
        // Данные
        this.currentUser = null;
        this.isAdmin = false;
        this.users = [];
        this.families = [];
        this.currentFamily = null;
        
        // Состояние интерфейса
        this.mode = 'profile';
        this.editingName = false;
        this.newName = '';
        
        // Текущее "активное" текстовое поле
        this.activeInput = null;

        this._disposables = createDisposables();
        this._notifier = null;
    }
    
    create() {
        const { width, height } = this.cameras.main;
        
        // Загружаем данные
        this.loadCurrentUser();
        this.loadUsers();
        this.loadFamilies();
        
        this._notifier = createNotificationManager(this, { startY: 95, depth: 4000, maxVisible: 2 });
        this._disposables.add(() => this._notifier?.destroy());
        this.events.once('shutdown', () => this._disposables.run());
        this.events.once('destroy', () => this._disposables.run());

        // Настраиваем ввод с клавиатуры (не removeAllListeners — чтобы не ломать плагины)
        const keyHandler = (event) => {
            if (!this.activeInput) return;
            
            const key = event.key;
            
            if (key === 'Backspace') {
                if (this.activeInput.inputValue !== undefined) {
                    this.activeInput.inputValue = this.activeInput.inputValue.slice(0, -1);
                    this.activeInput.setText(this.activeInput.inputValue);
                } else {
                    this.activeInput.text = this.activeInput.text.slice(0, -1);
                }
            } else if (key === 'Enter') {
                this.activeInput = null;
            } else if (key.length === 1 && !event.ctrlKey && !event.altKey) {
                if (this.activeInput.inputValue !== undefined) {
                    this.activeInput.inputValue += key.toUpperCase();
                    this.activeInput.setText(this.activeInput.inputValue);
                } else {
                    this.activeInput.text += key.toUpperCase();
                }
            }
        };
        this.input.keyboard.on('keydown', keyHandler);
        this._disposables.add(() => this.input.keyboard.off('keydown', keyHandler));
        
        // Фон (более темный для контраста)
        this.add.rectangle(0, 0, width, height, 0x2c3e50).setOrigin(0, 0);
        
        // Заголовок с тенью для читаемости
        const titleText = this.add.text(width/2, 50, 'Настройки', {
            fontSize: '40px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#1a2a3a',
            strokeThickness: 4
        }).setOrigin(0.5);
        titleText.setDepth(10);
        
        // Кнопка назад
        createRoundedTextButton(this, {
            x: 80,
            y: 30,
            radius: 14,
            fillColor: 0x2c3e50,
            hoverFillColor: 0x4ecca3,
            text: '← Назад',
            textStyle: { fontSize: '18px', fill: '#ffffff' },
            onClick: () => this.scene.start('MenuScene')
        });
        
        // Вкладки режимов
        this.createModeTabs();
        
        // Главный контейнер
        this.settingsContainer = this.add.container(100, 150);
        this.settingsContainer.setDepth(5);
        
        // Отображаем текущий режим
        this.displayCurrentMode();
    }
    
    createModeTabs() {
        const { width } = this.cameras.main;
        
        const tabs = [
            { key: 'profile', name: 'Профиль', x: width/2 - 250 },
            { key: 'family', name: 'Семья', x: width/2 - 50 }
        ];
        
        tabs.forEach(tab => {
            const btn = this.add.text(tab.x, 100, tab.name, {
                fontSize: '22px',
                fill: this.mode === tab.key ? '#4ecca3' : '#dddddd',
                backgroundColor: '#2c3e50',
                padding: { x: 20, y: 10 }
            })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.mode = tab.key;
                this.displayCurrentMode();
                
                this.children.list.forEach(child => {
                    if (child.type === 'Text' && child.text.length < 20 && child !== btn) {
                        child.setFill('#dddddd');
                    }
                });
                btn.setFill('#4ecca3');
            });
            btn.setDepth(10);
        });
    }
    
    displayCurrentMode() {
        if (this.mode === 'profile') {
            this.displayProfileSettings();
        } else if (this.mode === 'family') {
            this.displayFamilySettings();
        } else if (this.mode === 'app') {
            this.displayAppSettings();
        }
    }
    
 displayProfileSettings() {
    if (!this.settingsContainer) return;
    this.settingsContainer.removeAll(true);
    
    if (!this.currentUser) {
        this.settingsContainer.add(
            this.add.text(300, 100, 'Сначала войдите в систему', {
                fontSize: '24px',
                fill: '#cccccc'
            })
        );
        return;
    }
    
    let y = 0;
    
    // Аватар
    this.settingsContainer.add(
        this.add.text(200, y, 'Аватар:', { fontSize: '20px', fill: '#cccccc' })
    );
    
    const currentAvatar = this.add.text(350, y, this.currentUser.avatar || '👤', {
        fontSize: '60px'
    });
    this.settingsContainer.add(currentAvatar);
    
    const avatars = ['👩', '👨', '👧', '👦', '🧑', '👵', '👴', '🐶', '🐱', '🦊'];
    let x = 450;
    
    avatars.forEach(avatar => {
        const btn = this.add.text(x, y + 10, avatar, { fontSize: '40px' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.updateAvatar(avatar);
                currentAvatar.setText(avatar);
            });
        this.settingsContainer.add(btn);
        x += 60;
    });
    
    y += 80;
    
    // Имя
    this.settingsContainer.add(
        this.add.text(200, y, 'Имя:', { fontSize: '20px', fill: '#cccccc' })
    );
    
    const nameText = this.add.text(350, y, this.currentUser.name, {
        fontSize: '24px',
        fill: '#ffffff',
        fontStyle: 'bold'
    });
    this.settingsContainer.add(nameText);
    
    const editBtn = this.add.text(550, y - 10, '✎', {
        fontSize: '24px',
        fill: '#4ecca3',
        backgroundColor: '#2c3e50',
        padding: { x: 12, y: 8 }
    })
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => {
        this.showNameEditor(nameText);
    });
    this.settingsContainer.add(editBtn);
    
    y += 60;
    
    // Роль
    this.settingsContainer.add(
        this.add.text(200, y, 'Роль:', { fontSize: '20px', fill: '#cccccc' })
    );
    
    const roleIcon = this.currentUser.role === 'parent' ? '👑' : this.currentUser.role === 'user' ? '👤' : '🧒';
    const roleText = this.currentUser.role === 'parent' ? 'Родитель' : this.currentUser.role === 'user' ? 'Обычный пользователь' : 'Ребёнок';
    this.settingsContainer.add(
        this.add.text(350, y, `${roleIcon} ${roleText}`, { fontSize: '20px', fill: '#ffffff' })
    );
    
    y += 60;    

    
    // Статистика
    this.settingsContainer.add(
        this.add.text(200, y, 'Статистика', { fontSize: '22px', fill: '#ffffff', fontStyle: 'bold' })
    );
    
    y += 40;
    
    const tasks = JSON.parse(localStorage.getItem('homespace_tasks') || '[]');
    const userTasks = tasks.filter(t => t.assignedTo === this.currentUser.id);
    const completedTasks = userTasks.filter(t => t.completed);
    const totalBonuses = completedTasks.reduce((sum, t) => sum + (t.bonus || 0), 0);
    
    const stats = [
        `📋 Всего заданий: ${userTasks.length}`,
        `✅ Выполнено: ${completedTasks.length}`,
        `⏳ В ожидании: ${userTasks.length - completedTasks.length}`,
        `💰 Заработано бонусов: ${totalBonuses}`
    ];
    
    stats.forEach(stat => {
        this.settingsContainer.add(
            this.add.text(220, y, stat, { fontSize: '16px', fill: '#dddddd' })
        );
        y += 30;
    });
    
    y += 50;
    
    // Кнопка выхода
    const logoutBtn = this.add.text(350, y, 'Выйти', {
        fontSize: '20px',
        fill: '#ffffff',
        backgroundColor: '#e94560',
        padding: { x: 25, y: 12 }
    })
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => {
        api.logout();
        this.scene.start('RegistrationScene');
    });
    this.settingsContainer.add(logoutBtn);
}

displayFamilySettings() {
    if (!this.settingsContainer) return;
    this.settingsContainer.removeAll(true);
    
    if (!this.currentUser) {
        this.settingsContainer.add(
            this.add.text(300, 100, 'Сначала войдите в систему', {
                fontSize: '24px',
                fill: '#cccccc'
            })
        );
        return;
    }
    
    let y = 0;
    
    // Информация о семье
    if (this.currentUser.familyId) {
        const family = this.families.find(f => f.id === this.currentUser.familyId);
        
        if (family) {
            // Название семьи
            this.settingsContainer.add(
                this.add.text(200, y, 'Семья:', { fontSize: '24px', fill: '#cccccc' })
            );
            this.settingsContainer.add(
                this.add.text(350, y, family.name, {
                    fontSize: '28px',
                    fill: '#ffd700',
                    fontStyle: 'bold'
                })
            );
            
            y += 60;
            
            // Код приглашения
            this.settingsContainer.add(
                this.add.text(200, y + 12, 'Код приглашения:', { fontSize: '20px', fill: '#cccccc' })
            );
            
            const codeText = this.add.text(400, y, family.invite_code || family.code, {
                fontSize: '24px',
                fill: '#4ecca3',
                fontStyle: 'bold',
                backgroundColor: '#2c3e50',
                padding: { x: 15, y: 8 }
            });
            this.settingsContainer.add(codeText);
            
            const copyBtn = this.add.text(500, y , '📋', {
                fontSize: '24px',
                fill: '#4ecca3',
                backgroundColor: '#2c3e50',
                padding: { x: 12, y: 6 }
            })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                navigator.clipboard?.writeText(family.invite_code || family.code);
                this.showNotification('Код скопирован!', '#4ecca3');
            });
            this.settingsContainer.add(copyBtn);
            
            y += 70;
            
            // Члены семьи - ЗАГРУЖАЕМ С СЕРВЕРА
            this.settingsContainer.add(
                this.add.text(200, y, 'Участники:', { fontSize: '22px', fill: '#ffffff', fontStyle: 'bold' })
            );
            
            y += 40;
            
            // Показываем индикатор загрузки
            const loadingText = this.add.text(220, y, 'Загрузка участников...', {
                fontSize: '14px',
                fill: '#888888'
            });
            this.settingsContainer.add(loadingText);
            this.membersLoadingText = loadingText;
            
            // Загружаем членов семьи
            this.loadFamilyMembers().then(() => {
                this.updateMembersDisplay(y);
            });
        }
    } else {
        // Нет семьи - "Вы не в семье" и кнопка на одном уровне
        this.settingsContainer.add(
            this.add.text(200, y, 'Вы не в семье', { fontSize: '24px', fill: '#cccccc' })
        );
        
        // Кнопка создания семьи на том же уровне
        if (this.isAdmin) {
            const createBtn = this.add.text(450, y, 'Создать семью', {
                fontSize: '20px',
                fill: '#ffffff',
                backgroundColor: '#4ecca3',
                padding: { x: 20, y: 10 }
            })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.createFamily();
            });
            this.settingsContainer.add(createBtn);
        }
        
        y += 70;
        
        // Разделитель
        this.settingsContainer.add(
            this.add.rectangle(200, y, 500, 2, 0x4ecca3, 0.3).setOrigin(0, 0)
        );
        
        y += 30;
        
        // Вопрос о коде приглашения
        this.settingsContainer.add(
            this.add.text(200, y, 'Есть код приглашения?', { 
                fontSize: '20px', 
                fill: '#ffd700',
                fontStyle: 'bold'
            })
        );
        
        y += 50;
        
        // Поле ввода кода - БЕЛОЕ
        const inputBg = this.add.rectangle(200, y, 280, 45, 0xffffff)
            .setStrokeStyle(2, 0x4ecca3)
            .setOrigin(0, 0);
        this.settingsContainer.add(inputBg);
        
        const codeInput = this.add.text(215, y + 12, '', {
            fontSize: '18px',
            fill: '#000000'
        });
        codeInput.inputValue = '';
        this.settingsContainer.add(codeInput);
        
        const activateCodeInput = () => {
            this.activeInput = codeInput;
            inputBg.setStrokeStyle(3, 0xe94560);
        };
        
        inputBg.setInteractive({ useHandCursor: true }).on('pointerdown', activateCodeInput);
        codeInput.setInteractive({ useHandCursor: true }).on('pointerdown', activateCodeInput);
        
        // Плейсхолдер для поля ввода
        const placeholder = this.add.text(215, y + 12, 'Введите код приглашения', {
            fontSize: '18px',
            fill: '#999999',
            fontStyle: 'italic'
        });
        this.settingsContainer.add(placeholder);
        
        // Кнопка присоединения
        const joinBtn = this.add.text(500, y + 8, 'Присоединиться', {
            fontSize: '16px',
            fill: '#ffffff',
            backgroundColor: '#4ecca3',
            padding: { x: 15, y: 8 }
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            this.joinFamily(codeInput.inputValue || codeInput.text);
        });
        this.settingsContainer.add(joinBtn);
        
        // Обновление текста и плейсхолдера
        const updateHandler = () => {
            if (this.activeInput === codeInput) {
                codeInput.setText(codeInput.inputValue || '');
                placeholder.setVisible(!codeInput.inputValue);
            }
        };
        this.events.on('update', updateHandler);
        this.codeInputUpdateHandler = updateHandler;
        
        // Начальное состояние плейсхолдера
        placeholder.setVisible(true);
    }
}
    
    
    showNameEditor(nameText) {
        const { width, height } = this.cameras.main;
        
        const modalElements = [];
        
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setOrigin(0, 0).setDepth(2000).setInteractive();
        modalElements.push(bg);
        
        const modal = this.add.rectangle(width/2, height/2, 450, 220, 0x2c3e50)
            .setStrokeStyle(2, 0x4ecca3).setDepth(2001);
        modalElements.push(modal);
        
        this.add.text(width/2, height/2 - 70, 'Введите новое имя:', {
            fontSize: '20px', fill: '#ffffff'
        }).setOrigin(0.5).setDepth(2001);
        
        const inputBg = this.add.rectangle(width/2, height/2 - 10, 300, 45, 0x1a2a3a)
            .setStrokeStyle(2, 0x4ecca3).setDepth(2001);
        modalElements.push(inputBg);
        
        const inputText = this.add.text(width/2 - 140, height/2 - 20, this.currentUser.name, {
            fontSize: '18px', fill: '#ffffff'
        }).setDepth(2001);
        inputText.inputValue = this.currentUser.name;
        modalElements.push(inputText);
        
        inputBg.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.activeInput = inputText;
                inputBg.setStrokeStyle(3, 0xe94560);
            });
        
        const saveBtn = this.add.text(width/2 - 80, height/2 + 60, 'Сохранить', {
            fontSize: '18px', fill: '#ffffff', backgroundColor: '#4ecca3', padding: { x: 20, y: 10 }
        })
        .setInteractive({ useHandCursor: true }).setDepth(2001)
        .on('pointerdown', () => {
            const newName = inputText.inputValue?.trim() || inputText.text.trim();
            if (newName) {
                this.updateName(newName);
                nameText.setText(newName);
                modalElements.forEach(el => el.destroy());
                this.activeInput = null;
            }
        });
        modalElements.push(saveBtn);
        
        const cancelBtn = this.add.text(width/2 + 80, height/2 + 60, 'Отмена', {
            fontSize: '18px', fill: '#ffffff', backgroundColor: '#e94560', padding: { x: 20, y: 10 }
        })
        .setInteractive({ useHandCursor: true }).setDepth(2001)
        .on('pointerdown', () => {
            modalElements.forEach(el => el.destroy());
            this.activeInput = null;
        });
        modalElements.push(cancelBtn);
        
        const updateHandler = () => {
            if (this.activeInput === inputText) {
                inputText.setText(inputText.inputValue || '');
            }
        };
        this.events.on('update', updateHandler);
        modalElements.push({ destroy: () => this.events.off('update', updateHandler) });
    }
    
    updateAvatar(newAvatar) {
        if (!this.currentUser) return;
        this.currentUser.avatar = newAvatar;
        localStorage.setItem('homespace_currentUser', JSON.stringify(this.currentUser));
        this.showNotification('Аватар обновлён!', '#4ecca3');
    }
    
    updateName(newName) {
        if (!this.currentUser) return;
        const oldName = this.currentUser.name;
        this.currentUser.name = newName;
        localStorage.setItem('homespace_currentUser', JSON.stringify(this.currentUser));
        this.showNotification('Имя обновлено!', '#4ecca3');
    }
    
    async createFamily() {
        if (!this.currentUser || !this.isAdmin) {
            this.showNotification('Недостаточно прав для создания семьи', '#e94560');
            return;
        }
        
        if (this.currentUser.familyId) {
            this.showNotification('Вы уже состоите в семье', '#e94560');
            return;
        }
        
        const { width, height } = this.cameras.main;
        const modalElements = [];
        
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setOrigin(0, 0).setDepth(2000).setInteractive();
        modalElements.push(bg);
        
        const modal = this.add.rectangle(width/2, height/2, 450, 250, 0x2c3e50)
            .setStrokeStyle(2, 0x4ecca3).setDepth(2001);
        modalElements.push(modal);
        
        this.add.text(width/2, height/2 - 80, 'Создать семью', {
            fontSize: '24px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(2001);
        
        const inputBg = this.add.rectangle(width/2, height/2 - 20, 300, 45, 0x1a2a3a)
            .setStrokeStyle(2, 0x4ecca3).setDepth(2001);
        modalElements.push(inputBg);
        
        const nameInput = this.add.text(width/2 - 140, height/2 - 30, '', {
            fontSize: '16px', fill: '#ffffff'
        }).setDepth(2001);
        nameInput.inputValue = '';
        modalElements.push(nameInput);
        
        const placeholder = this.add.text(width/2 - 140, height/2 - 30, 'Название семьи', {
            fontSize: '16px', fill: '#888888', fontStyle: 'italic'
        }).setDepth(2001);
        modalElements.push(placeholder);
        
        inputBg.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.activeInput = nameInput;
                inputBg.setStrokeStyle(3, 0xe94560);
                placeholder.setVisible(false);
            });
        
        const createBtn = this.add.text(width/2 - 70, height/2 + 60, 'Создать', {
            fontSize: '18px', fill: '#ffffff', backgroundColor: '#4ecca3', padding: { x: 20, y: 10 }
        })
        .setInteractive({ useHandCursor: true }).setDepth(2001)
        .on('pointerdown', async () => {
            const familyName = nameInput.inputValue.trim();
            if (!familyName) {
                this.showNotification('Введите название семьи', '#e94560');
                return;
            }
            
            try {
                const response = await fetch('http://localhost:3001/api/family/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('homespace_token')}`
                    },
                    body: JSON.stringify({ name: familyName })
                });
                
                const data = await response.json();
                
                if (!response.ok) throw new Error(data.error || 'Ошибка создания семьи');
                
                if (data.token) localStorage.setItem('homespace_token', data.token);
                
                this.currentUser.familyId = data.family.id;
                localStorage.setItem('homespace_currentUser', JSON.stringify(this.currentUser));
                
                modalElements.forEach(el => el.destroy());
                this.activeInput = null;
                
                this.showNotification(`Семья "${familyName}" создана! Код: ${data.family.invite_code}`, '#4ecca3');
                await this.loadFamilies();
                this.displayFamilySettings();
                
            } catch (error) {
                this.showNotification(error.message, '#e94560');
            }
        });
        modalElements.push(createBtn);
        
        const cancelBtn = this.add.text(width/2 + 90, height/2 + 60, 'Отмена', {
            fontSize: '18px', fill: '#ffffff', backgroundColor: '#e94560', padding: { x: 20, y: 10 }
        })
        .setInteractive({ useHandCursor: true }).setDepth(2001)
        .on('pointerdown', () => {
            modalElements.forEach(el => el.destroy());
            this.activeInput = null;
        });
        modalElements.push(cancelBtn);
        
        const updateHandler = () => {
            if (this.activeInput === nameInput) {
                nameInput.setText(nameInput.inputValue || '');
                placeholder.setVisible(!nameInput.inputValue);
            }
        };
        this.events.on('update', updateHandler);
        modalElements.push({ destroy: () => this.events.off('update', updateHandler) });
    }
    
    async joinFamily(code) {
        if (!code) {
            this.showNotification('Введите код', '#e94560');
            return;
        }
        
        try {
            const response = await fetch('http://localhost:3001/api/family/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('homespace_token')}`
                },
                body: JSON.stringify({ code: code.toUpperCase() })
            });
            
            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Ошибка присоединения');
            
            if (data.token) localStorage.setItem('homespace_token', data.token);
            
            this.currentUser.familyId = data.family.id;
            localStorage.setItem('homespace_currentUser', JSON.stringify(this.currentUser));
            
            this.showNotification(`Вы присоединились к семье "${data.family.name}"!`, '#4ecca3');
            await this.loadFamilies();
            this.displayFamilySettings();
            
        } catch (error) {
            this.showNotification(error.message, '#e94560');
        }
    }
    
    async loadFamilies() {
        try {
            const response = await fetch('http://localhost:3001/api/family', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('homespace_token')}` }
            });
            const data = await response.json();
            
            if (data.success && data.family) {
                this.currentFamily = data.family;
                this.families = [data.family];
            } else {
                this.families = [];
            }
        } catch (error) {
            console.error('Ошибка загрузки семьи:', error);
            this.families = [];
        }
    }
    
    loadCurrentUser() {
        this.currentUser = api.getCurrentUser();
        this.isAdmin = this.currentUser?.role === 'parent' || this.currentUser?.role === 'admin';
    }

    showNotification(text, color = '#4ecca3') {
        const type =
            color === '#e94560' ? 'error' :
            color === '#ffd700' ? 'warning' :
            color === '#4ecca3' ? 'success' :
            'info';
        this._notifier?.show(text, type, { color, fontSize: '16px' });
    }
    
    loadUsers() {
        const saved = localStorage.getItem('homespace_users');
        if (saved) {
            try {
                this.users = JSON.parse(saved);
            } catch (e) {
                this.users = [];
            }
        }
    }
    
async loadFamilyMembers() {
    if (!this.currentUser?.familyId) return;
    
    try {
        const response = await fetch(`http://localhost:3001/api/families/${this.currentUser.familyId}/members`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('homespace_token')}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            this.users = data;
            // Сохраняем в localStorage для совместимости
            localStorage.setItem('homespace_users', JSON.stringify(this.users));
        }
    } catch (error) {
        console.error('Ошибка загрузки членов семьи:', error);
    }
}

// Добавь этот метод для обновления отображения участников
updateMembersDisplay(startY) {
    // Удаляем индикатор загрузки
    if (this.membersLoadingText) {
        this.membersLoadingText.destroy();
        this.membersLoadingText = null;
    }
    
    let y = startY;
    
    if (!this.users || this.users.length === 0) {
        this.settingsContainer.add(
            this.add.text(220, y, 'Нет участников', {
                fontSize: '14px',
                fill: '#888888'
            })
        );
        return;
    }
    
    this.users.forEach(member => {
        const roleIcon = member.role === 'parent' ? '👑' : '🧒';
        const roleText = member.role === 'parent' ? 'Родитель' : 'Ребёнок';
        const isYou = member.id === this.currentUser?.id ? ' (вы)' : '';
        
        this.settingsContainer.add(
            this.add.text(220, y, `${roleIcon} ${member.name}${isYou} - ${roleText}`, {
                fontSize: '16px',
                fill: member.role === 'parent' ? '#4ecca3' : '#dddddd'
            })
        );
        
        // Статус онлайн
        const online = member.last_login && (new Date() - new Date(member.last_login)) < 5 * 60 * 1000;
        this.settingsContainer.add(
            this.add.circle(520, y + 8, 6, online ? 0x4ecca3 : 0x888888)
        );
        
        y += 35;
    });
}
    
    destroy() {
        if (this.codeInputUpdateHandler) {
            this.events.off('update', this.codeInputUpdateHandler);
        }
        this._disposables.run();
        super.destroy();
    }
}