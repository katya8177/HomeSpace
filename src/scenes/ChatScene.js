// src/scenes/ChatScene.js
import { api } from '../services/api.js';
import { createRoundedTextButton } from '../utils/ui.js';
import { createDisposables, createNotificationManager, createScrollArea } from '../utils/sceneUi.js';

export class ChatScene extends Phaser.Scene {
    constructor() {
        super('ChatScene');
        
        this.messages = [];
        this.users = [];
        this.currentUser = null;
        this.chatMode = 'family';
        this.selectedUser = null;
        this.inputText = '';
        this.isLoading = false;
        this.refreshInterval = null;
        this.activeInput = false;

        this._disposables = createDisposables();
        this._notifier = null;

        this._messagesScroll = null;
        this._stickToBottom = true;
        this._lastMessageId = null;
    }
    
    create() {
        const { width, height } = this.cameras.main;
        
        this.screenWidth = width;
        this.screenHeight = height;
        
        this.currentUser = api.getCurrentUser();
        
        if (!this.currentUser || !localStorage.getItem('homespace_token')) {
            this.showLoginRequired();
            return;
        }
        
        // Фон
        this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0, 0);
        
        // Верхняя панель
        this.createTopBar();
        
        // Панель пользователей
        this.createUsersPanel();
        
        // Область сообщений
        this.createMessagesArea();
        
        // Строка ввода внизу
        this.createInputArea();
        
        // Индикатор загрузки
        this.loadingText = this.add.text(width/2, height/2, 'Загрузка...', {
            fontSize: '24px',
            fill: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);
        this.loadingText.setVisible(false);
        
        this.loadUsers();
        this.loadMessages();
        this.setupKeyboard();
        
        this.refreshInterval = setInterval(() => {
            if (!this.isLoading) this.loadMessages();
        }, 5000);

        this._notifier = createNotificationManager(this, { startY: 105, depth: 4000, maxVisible: 2, duration: 1600 });
        this._disposables.add(() => this._notifier?.destroy());
        this._disposables.add(() => {
            if (this.refreshInterval) clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        });
        this.events.once('shutdown', () => this._disposables.run());
        this.events.once('destroy', () => this._disposables.run());
    }
    
    showLoginRequired() {
        const { width, height } = this.cameras.main;
        this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0, 0);
        this.add.text(width/2, height/2 - 40, 'Нужен вход в аккаунт', {
            fontSize: '28px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(width/2, height/2, 'Чтобы общаться в чате, войдите в систему.', {
            fontSize: '16px',
            fill: '#cccccc'
        }).setOrigin(0.5);
        
        const loginBtn = this.add.text(width/2, height/2 + 60, 'Перейти к входу', {
            fontSize: '18px',
            fill: '#ffffff',
            backgroundColor: '#4ecca3',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        loginBtn.on('pointerdown', () => this.scene.start('RegistrationScene'));
        
        const backBtn = this.add.text(80, 30, '← Назад', {
            fontSize: '18px',
            fill: '#ffffff',
            backgroundColor: '#e94560',
            padding: { x: 15, y: 8 }
        }).setInteractive({ useHandCursor: true });
        backBtn.on('pointerdown', () => this.scene.start('MenuScene'));
    }
    
    createTopBar() {
        const { width } = this.cameras.main;
        
        this.add.rectangle(0, 0, width, 70, 0x0f0f1a).setOrigin(0, 0);
        
        const backBtn = this.add.text(20, 22, '←', {
            fontSize: '28px',
            fill: '#ffffff',
            backgroundColor: '#e94560',
            padding: { x: 12, y: 5 }
        }).setInteractive({ useHandCursor: true });
        backBtn.on('pointerdown', () => this.scene.start('MenuScene'));
        
        this.titleText = this.add.text(width/2, 24, 'Семейный чат', {
            fontSize: '24px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        const refreshBtn = this.add.text(width - 60, 22, '⟳', {
            fontSize: '28px',
            fill: '#4ecca3'
        }).setInteractive({ useHandCursor: true });
        refreshBtn.on('pointerdown', () => this.loadMessages());
    }
    
createUsersPanel() {
    const { width, height } = this.cameras.main;
    
    const panelWidth = 260;
    const panelX = width - panelWidth - 15;
    const panelY = 80;
    const panelHeight = height - 150;
    
    // Фон панели
    this.usersPanelBg = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x0f0f1a)
        .setStrokeStyle(1, 0x4ecca3)
        .setOrigin(0, 0);
    
    // Заголовок "УЧАСТНИКИ" по центру панели
    this.add.text(panelX + panelWidth/2, panelY + 18, 'УЧАСТНИКИ', {
        fontSize: '14px',
        fill: '#4ecca3',
        fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Размеры кнопок
    const btnWidth = 220;
    const btnHeight = 44;
    const btnX = panelX + (panelWidth - btnWidth) / 2; // Центрируем кнопку по горизонтали
    const startY = panelY + 48; // Отступ от заголовка
    
    // Кнопка семейного чата (по центру панели)
    this.familyBtnBg = this.add.rectangle(btnX, startY, btnWidth, btnHeight, 
        this.chatMode === 'family' ? 0x4ecca3 : 0x2c3e50)
        .setStrokeStyle(1, 0x4ecca3)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.switchToFamilyChat());
    
    // Иконка и текст внутри кнопки (по центру)
    this.add.text(btnX + 25, startY + btnHeight/2, '👥', {
        fontSize: '24px'
    }).setOrigin(0, 0.5);
    
    this.add.text(btnX + 58, startY + btnHeight/2, 'СЕМЕЙНЫЙ ЧАТ', {
        fontSize: '13px',
        fill: '#ffffff',
        fontStyle: this.chatMode === 'family' ? 'bold' : 'normal'
    }).setOrigin(0, 0.5);
    
    // Полоска для активного чата
    if (this.chatMode === 'family') {
        this.add.rectangle(btnX, startY, 4, btnHeight, 0x4ecca3).setOrigin(0, 0);
    }
    
    // Контейнер для списка пользователей (начинается под кнопкой семейного чата)
    this.usersContainer = this.add.container(btnX, startY + btnHeight + 8);
}
    
    createMessagesArea() {
        const { width, height } = this.cameras.main;
        
        this.messagesX = 20;
        this.messagesY = 80;
        this.messagesWidth = width - 260;
        this.messagesHeight = height - 150;
        
        this.messagesBg = this.add.rectangle(this.messagesX, this.messagesY, 
            this.messagesWidth, this.messagesHeight, 0x0f0f1a)
            .setStrokeStyle(1, 0x4ecca3)
            .setOrigin(0, 0);
        
        // Контент рисуем от верхней границы, скролл будет смещать контейнер
        this.messagesContainer = this.add.container(this.messagesX + 10, this.messagesY + 10);

        // Скролл области сообщений
        this._messagesScroll = createScrollArea(this, {
            x: this.messagesX,
            y: this.messagesY,
            width: this.messagesWidth,
            height: this.messagesHeight,
            content: this.messagesContainer,
            wheelStep: 90
        });
        this._disposables.add(() => this._messagesScroll?.destroy());
    }
    
    createInputArea() {
        const { width, height } = this.cameras.main;
        
        const inputX = 30;
        const inputY = height - 65;
        const inputWidth = width - 290;
        
        // Фон поля ввода
        this.inputBg = this.add.rectangle(inputX, inputY, inputWidth, 48, 0x2c3e50)
            .setStrokeStyle(2, 0x4ecca3)
            .setOrigin(0, 0);
        
        this.inputDisplay = this.add.text(inputX + 15, inputY + 14, '', {
            fontSize: '18px',
            fill: '#ffffff'
        });
        
        this.placeholder = this.add.text(inputX + 15, inputY + 14, 'Введите сообщение...', {
            fontSize: '18px',
            fill: '#666666',
            fontStyle: 'italic'
        });
        
        this.inputBg.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.activeInput = true;
                this.inputBg.setStrokeStyle(3, 0xe94560);
                this.placeholder.setVisible(false);
            });
        
        const sendBtnX = inputX + inputWidth + 10;
        const sendBtn = this.add.rectangle(sendBtnX, inputY, 48, 48, 0x4ecca3)
            .setInteractive({ useHandCursor: true });
        
        this.add.text(sendBtnX + 24, inputY + 24, '→', {
            fontSize: '28px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        sendBtn.on('pointerdown', () => this.sendMessage());
    }
    
    setupKeyboard() {
        const keyHandler = (event) => {
            if (!this.activeInput) return;
            
            const key = event.key;
            
            if (key === 'Backspace') {
                this.inputText = this.inputText.slice(0, -1);
                this.inputDisplay.setText(this.inputText);
            } else if (key === 'Enter') {
                this.sendMessage();
            } else if (key.length === 1 && !event.ctrlKey && !event.altKey) {
                this.inputText += key;
                this.inputDisplay.setText(this.inputText);
            }
            
            if (this.placeholder) {
                this.placeholder.setVisible(this.inputText.length === 0);
            }
        };
        this.input.keyboard.on('keydown', keyHandler);
        this._disposables.add(() => this.input.keyboard.off('keydown', keyHandler));
    }
    
    async loadUsers() {
        try {
            if (!this.currentUser?.familyId) return;
            
            const users = await api.getFamilyMembers();
            this.users = users.filter(u => u.id !== this.currentUser?.id);
            this.displayUsers();
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
        }
    }
    
displayUsers() {
    if (!this.usersContainer) return;
    this.usersContainer.removeAll(true);
    
    if (this.users.length === 0) {
        this.usersContainer.add(
            this.add.text(110, 20, 'Нет участников', {
                fontSize: '12px',
                fill: '#888888'
            }).setOrigin(0.5)
        );
        return;
    }
    
    let y = 0;
    const btnWidth = 220;
    const btnHeight = 44;
    const spacing = 8; // Отступ между кнопками
    
    this.users.forEach(user => {
        const isSelected = this.selectedUser?.id === user.id;
        const isActive = (this.chatMode === 'private' && isSelected);
        
        // Фон кнопки
        const bgColor = isActive ? 0x4ecca3 : 0x2c3e50;
        
        const userBg = this.add.rectangle(0, y, btnWidth, btnHeight, bgColor)
            .setStrokeStyle(1, 0x4ecca3)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.switchToPrivateChat(user));
        this.usersContainer.add(userBg);
        
        // Аватар (по центру по вертикали)
        this.usersContainer.add(
            this.add.text(12, y + btnHeight/2, user.avatar || '👤', { 
                fontSize: '26px'
            }).setOrigin(0, 0.5)
        );
        
        // Имя (по центру по вертикали)
        const name = user.name.length > 16 ? user.name.substring(0, 14) + '...' : user.name;
        this.usersContainer.add(
            this.add.text(48, y + btnHeight/2, name, { 
                fontSize: '13px', 
                fill: '#ffffff',
                fontStyle: isActive ? 'bold' : 'normal'
            }).setOrigin(0, 0.5)
        );
        
        // Полоска для выделения активного чата
        if (isActive) {
            this.usersContainer.add(
                this.add.rectangle(0, y, 4, btnHeight, 0x4ecca3).setOrigin(0, 0)
            );
        }
        
        y += btnHeight + spacing;
    });
}
    
    async loadMessages() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.loadingText.setVisible(true);
        
        try {
            let messages = [];
            
            if (this.chatMode === 'private' && this.selectedUser) {
                messages = await api.getMessages({
                    type: 'private',
                    withUserId: this.selectedUser.id
                });
            } else {
                messages = await api.getMessages({ type: 'family' });
            }
            
            this.messages = messages;
            this.displayMessages();
            
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
            this.showNotification('Ошибка загрузки', '#e94560');
        } finally {
            this.isLoading = false;
            this.loadingText.setVisible(false);
        }
    }
    
    displayMessages() {
        if (!this.messagesContainer) return;
        // Запоминаем позицию скролла (если пользователь листает вверх)
        const prevScroll = this._messagesScroll?.getScrollY?.() ?? 0;
        const prevMax = this._messagesScroll?.getMaxScroll?.() ?? 0;
        const nearBottom = (prevMax - prevScroll) < 40;
        this._stickToBottom = nearBottom;

        this.messagesContainer.removeAll(true);
        
        if (this.messages.length === 0) {
            const centerX = this.messagesWidth / 2;
            const noMsgText = this.add.text(centerX, 60, 'Нет сообщений.\nНапишите первое!', {
                fontSize: '18px',
                fill: '#888888',
                align: 'center'
            }).setOrigin(0.5);
            this.messagesContainer.add(noMsgText);
            return;
        }
        
        let y = 0;
        const maxWidth = this.messagesWidth - 40;
        
        // Отображаем от старых к новым (сверху вниз)
        this.messages.forEach((msg) => {
            const isMe = msg.user_id === this.currentUser?.id;
            const isBot = msg.type === 'bot';
            
            const msgX = isMe ? maxWidth - 20 : 10;
            const textColor = isMe ? '#4ecca3' : (isBot ? '#ffd700' : '#ffffff');
            const bgColor = isMe ? 0x1a4a3a : (isBot ? 0x3a2a1a : 0x2c3e50);
            
            const textWidth = Math.min(msg.message.length * 7, maxWidth - 60);
            const lines = Math.ceil(msg.message.length / 45);
            const textHeight = Math.max(32, lines * 18 + 8);
            
            // Имя отправителя (строго над сообщением)
            if (!isMe && msg.user_name) {
                const nameText = this.add.text(12, y + 2, msg.user_name, {
                    fontSize: '11px',
                    fill: '#aaaaaa'
                });
                this.messagesContainer.add(nameText);
                y += 16;
            }
            
            // Фон сообщения
            const bg = this.add.rectangle(
                msgX,
                y + textHeight,
                textWidth + 24,
                textHeight,
                bgColor,
                0.9
            ).setOrigin(isMe ? 1 : 0, 1);
            this.messagesContainer.add(bg);
            
            // Текст сообщения
            const messageText = this.add.text(
                msgX + (isMe ? -textWidth - 12 : 12),
                y + textHeight - 8,
                msg.message,
                {
                    fontSize: '13px',
                    fill: textColor,
                    wordWrap: { width: textWidth }
                }
            ).setOrigin(0, 1);
            this.messagesContainer.add(messageText);
            
            // Время
            const time = new Date(msg.created_at).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const timeX = isMe ? msgX - 12 : msgX + textWidth + 28;
            this.messagesContainer.add(
                this.add.text(timeX, y + textHeight - 4, time, {
                    fontSize: '9px',
                    fill: '#666666'
                }).setOrigin(isMe ? 1 : 0, 1)
            );
            
            y += textHeight + 8;
        });

        // Обновляем скролл-границы и позицию
        this._messagesScroll?.clampScroll?.();
        if (this._stickToBottom) {
            this._messagesScroll?.setScrollY?.(this._messagesScroll.getMaxScroll());
        } else {
            this._messagesScroll?.setScrollY?.(prevScroll);
        }
    }
    
    async sendMessage() {
        if (!this.inputText.trim()) return;
        
        const message = this.inputText.trim();
        this.inputText = '';
        this.inputDisplay.setText('');
        if (this.placeholder) this.placeholder.setVisible(true);
        
        try {
            const messageData = {
                message: message,
                type: this.chatMode
            };
            
            if (this.chatMode === 'private' && this.selectedUser && this.selectedUser.id) {
                messageData.recipientId = this.selectedUser.id;
            }
            
            const newMessage = await api.sendMessage(messageData);
            this.messages.push(newMessage);
            this.displayMessages();
            this._lastMessageId = newMessage?.id || this._lastMessageId;
            
        } catch (error) {
            console.error('Ошибка отправки:', error);
            this.showNotification('Ошибка отправки', '#e94560');
            this.inputText = message;
            this.inputDisplay.setText(message);
            if (this.placeholder) this.placeholder.setVisible(false);
        }
    }
    
    switchToPrivateChat(user) {
        this.chatMode = 'private';
        this.selectedUser = user;
        
        if (this.titleText) {
            this.titleText.setText(`Чат с ${user.name}`);
        }
        
        // Обновляем цвет кнопки семейного чата
        if (this.familyBtnBg) {
            this.familyBtnBg.setFillStyle(0x2c3e50);
        }
        
        this.inputText = '';
        this.inputDisplay?.setText('');
        if (this.placeholder) this.placeholder.setVisible(true);
        
        this.loadMessages();
        this.displayUsers();
        
        this.showNotification(`Чат с ${user.name}`, '#4ecca3');
    }
    
    switchToFamilyChat() {
        this.chatMode = 'family';
        this.selectedUser = null;
        
        if (this.titleText) {
            this.titleText.setText('Семейный чат');
        }
        
        // Обновляем цвет кнопки семейного чата
        if (this.familyBtnBg) {
            this.familyBtnBg.setFillStyle(0x4ecca3);
        }
        
        this.inputText = '';
        this.inputDisplay?.setText('');
        if (this.placeholder) this.placeholder.setVisible(true);
        
        this.loadMessages();
        this.displayUsers();
        
        this.showNotification('Семейный чат', '#4ecca3');
    }
    
    showNotification(text, color = '#4ecca3') {
        const type =
            color === '#e94560' ? 'error' :
            color === '#ffd700' ? 'warning' :
            color === '#4ecca3' ? 'success' :
            'info';
        this._notifier?.show(text, type, { color, fontSize: '14px', duration: 1500 });
    }
    
    destroy() {
        this._disposables.run();
        super.destroy();
    }
}