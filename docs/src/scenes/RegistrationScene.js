// src/scenes/RegistrationScene.js
import { api } from '../services/api.js';
import { createRoundedRectButton, createRoundedTextButton } from '../utils/ui.js';
import { createDisposables, createNotificationManager } from '../utils/sceneUi.js';

export class RegistrationScene extends Phaser.Scene {
    constructor() {
        super('RegistrationScene');
        this.currentScreen = 'main';
        this.background = null;
        this.activeInput = null;
        this.formData = {
            name: '',
            email: '',
            password: '',
            role: 'child',
            avatar: '👧',
            familyAction: 'none',
            familyCode: ''
        };
        this.errorMessage = '';
        this.successMessage = '';
        this.familyButtons = [];
        this.inputFields = [];

        this._disposables = createDisposables();
        this._notifier = null;
    }
    
    create() {
        const { width, height } = this.cameras.main;
        
        this.checkExistingLogin();
        this._notifier = createNotificationManager(this, { startY: 95, depth: 4000, maxVisible: 2 });
        this._disposables.add(() => this._notifier?.destroy());
        this.events.once('shutdown', () => this._disposables.run());
        this.events.once('destroy', () => this._disposables.run());
        
        // Фон
        this.background = this.add.rectangle(0, 0, width, height, 0x7faee1).setOrigin(0, 0);
        
        const keyHandler = (event) => {
            if (!this.activeInput) return;
            
            const key = event.key;
            
            if (key === 'Backspace') {
                // Удаляем последний символ
                this.activeInput.inputValue = this.activeInput.inputValue.slice(0, -1);
            } else if (key === 'Enter') {
                this.activeInput = null;
            } else if (key.length === 1 && !event.ctrlKey && !event.altKey) {
                // Добавляем символ
                this.activeInput.inputValue += key;
            }
            
            // Сразу обновляем отображение текста
            this.activeInput.setText(this.activeInput.inputValue);
        };
        this.input.keyboard.on('keydown', keyHandler);
        this._disposables.add(() => this.input.keyboard.off('keydown', keyHandler));
        
        this.showMainScreen();
        
        // Единый обработчик обновления для всех полей ввода
        const updateHandler = () => {
            this.inputFields.forEach(field => {
                const text = field.text;
                const placeholder = field.placeholder;
                
                // Обновляем отображаемый текст из inputValue
                if (text.inputValue !== undefined) {
                    text.setText(text.inputValue || '');
                }
                
                // Управляем placeholder
                if (text.inputValue && text.inputValue.length > 0) {
                    placeholder.setVisible(false);
                } else {
                    placeholder.setVisible(this.activeInput !== text);
                }
            });
        };
        this.events.on('update', updateHandler);
        this._disposables.add(() => this.events.off('update', updateHandler));
    }
    
    async checkExistingLogin() {
        const user = api.getCurrentUser();
        if (user) {
            try {
                const verified = await api.verifyToken();
                if (verified) {
                    this.scene.start('MenuScene');
                } else {
                    api.logout();
                }
            } catch (error) {
                api.logout();
            }
        }
    }
    
    showMainScreen() {
        const { width, height } = this.cameras.main;
        
        this.currentScreen = 'main';
        this.clearScreen();
        
        // Логотип
        this.add.text(width / 2, 120, '🏠', {
            fontSize: '100px'
        }).setOrigin(0.5);
        
        this.add.text(width / 2, 220, 'HomeSpace', {
            fontSize: '56px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#0850ed',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        this.add.text(width / 2, 280, 'Семейный органайзер', {
            fontSize: '20px',
            fill: 'rgba(255,255,255,0.8)'
        }).setOrigin(0.5);
        
        // Кнопки
        this.createButton(width / 2 - 150, 400, 'Вход', 0x07488d, () => this.showLoginScreen());
        this.createButton(width / 2 + 150, 400, 'Регистрация', 0x07488d, () => this.showRegisterScreen());
    }
    
    showRegisterScreen() {
        const { width, height } = this.cameras.main;
        
        this.currentScreen = 'register';
        this.clearScreen();
        this.familyButtons = [];
        this.inputFields = [];
        
        // Заголовок
        this.add.text(width / 2, 40, 'Регистрация', {
            fontSize: '40px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#0850ed',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        const startY = 100;
        const labelX = width / 2 - 200;
        const inputX = width / 2;
        const inputWidth = 300;
        const rowHeight = 45;
        const buttonWidth = 110;
        const spacing = 15;
        
        let currentY = startY;
        
        // Email
        this.add.text(labelX, currentY, 'Email:', {
            fontSize: '18px',
            fill: '#ffffff'
        }).setOrigin(0, 0.5);
        
        const emailInput = this.createInput(inputX, currentY, inputWidth, 'email@example.com');
        currentY += rowHeight;
        
        // Пароль
        this.add.text(labelX, currentY, 'Пароль:', {
            fontSize: '18px',
            fill: '#ffffff'
        }).setOrigin(0, 0.5);
        
        const passwordInput = this.createInput(inputX, currentY, inputWidth, 'минимум 3 символа');
        currentY += rowHeight;
        
        // Имя
        this.add.text(labelX, currentY, 'Имя:', {
            fontSize: '18px',
            fill: '#ffffff'
        }).setOrigin(0, 0.5);
        
        const nameInput = this.createInput(inputX, currentY, inputWidth, 'Ваше имя');
        currentY += rowHeight + 10;
        
        // Роль
        this.add.text(labelX, currentY, 'Кто вы?', {
            fontSize: '18px',
            fill: '#ffffff'
        }).setOrigin(0, 0.5);
        
        // Кнопки роли
        this.createRoleButton(inputX, currentY, 'Родитель', 'parent');
        this.createRoleButton(inputX + 120, currentY, 'Ребёнок', 'child');
        this.createRoleButton(inputX + 240, currentY, 'Пользователь', 'user');
        
        currentY += rowHeight;
        
        // Аватар
        this.add.text(labelX, currentY, 'Аватар:', {
            fontSize: '18px',
            fill: '#ffffff'
        }).setOrigin(0, 0.5);
        
        this.createAvatarSelector(inputX, currentY);
        currentY += rowHeight + 10;
        
        // Семья
        this.add.text(labelX, currentY, 'Семья:', {
            fontSize: '18px',
            fill: '#ffffff'
        }).setOrigin(0, 0.5);
        
        // Кнопка "Без семьи"
        const btnNone = this.add.text(inputX, currentY, 'Без семьи', {
            fontSize: '14px',
            fill: '#ffffff',
            backgroundColor: this.formData.familyAction === 'none' ? '#4ecca3' : '#232931',
            padding: { x: 12, y: 8 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            this.formData.familyAction = 'none';
            this.formData.familyCode = '';
            this.updateFamilyButtons();
        });
        this.familyButtons.push(btnNone);
        
        // Кнопка "Создать"
        const btnCreate = this.add.text(inputX + buttonWidth + spacing, currentY, 'Создать', {
            fontSize: '14px',
            fill: '#ffffff',
            backgroundColor: this.formData.familyAction === 'create' ? '#4ecca3' : '#232931',
            padding: { x: 12, y: 8 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            this.formData.familyAction = 'create';
            this.formData.familyCode = '';
            this.updateFamilyButtons();
        });
        this.familyButtons.push(btnCreate);
        
        // Кнопка "Присоединиться"
        const btnJoin = this.add.text(inputX + (buttonWidth + spacing) * 2, currentY, 'Присоединиться', {
            fontSize: '14px',
            fill: '#ffffff',
            backgroundColor: this.formData.familyAction === 'join' ? '#4ecca3' : '#232931',
            padding: { x: 12, y: 8 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            this.formData.familyAction = 'join';
            this.showCodeInput();
        });
        this.familyButtons.push(btnJoin);
        
        currentY += rowHeight;
        
        // Сообщение об ошибке/успехе
        this.errorText = this.add.text(width / 2, currentY, '', {
            fontSize: '16px',
            fill: '#e94560'
        }).setOrigin(0.5);
        currentY += 40;
        
        // Кнопка регистрации
        this.createButton(width / 2, currentY, 'Зарегистрироваться', 0x07488d, async () => {
            await this.handleRegister(nameInput.inputValue, emailInput.inputValue, passwordInput.inputValue);
        });
        
        // Кнопка назад
        this.createBackButton();
    }
    
    updateFamilyButtons() {
        if (this.familyButtons && this.familyButtons.length === 3) {
            this.familyButtons[0].setBackgroundColor(this.formData.familyAction === 'none' ? '#4ecca3' : '#232931');
            this.familyButtons[1].setBackgroundColor(this.formData.familyAction === 'create' ? '#4ecca3' : '#232931');
            this.familyButtons[2].setBackgroundColor(this.formData.familyAction === 'join' ? '#4ecca3' : '#232931');
        }
    }
    
    showLoginScreen() {
        const { width, height } = this.cameras.main;
        
        this.currentScreen = 'login';
        this.clearScreen();
        this.inputFields = [];
        
        this.add.text(width / 2, 80, 'Вход', {
            fontSize: '40px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#0850ed',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        const startY = 160;
        const labelX = width / 2 - 150;
        const inputX = width / 2;
        const inputWidth = 250;
        const rowHeight = 50;
        
        let currentY = startY;
        
        // Email
        this.add.text(labelX, currentY, 'Email:', {
            fontSize: '18px',
            fill: '#ffffff'
        }).setOrigin(0, 0.5);
        
        const emailInput = this.createInput(inputX, currentY, inputWidth, 'email@example.com');
        currentY += rowHeight;
        
        // Пароль
        this.add.text(labelX, currentY, 'Пароль:', {
            fontSize: '18px',
            fill: '#ffffff'
        }).setOrigin(0, 0.5);
        
        const passwordInput = this.createInput(inputX, currentY, inputWidth, 'пароль');
        currentY += rowHeight + 20;
        
        // Ошибка
        this.errorText = this.add.text(width / 2, currentY, '', {
            fontSize: '16px',
            fill: '#e94560'
        }).setOrigin(0.5);
        currentY += 40;
        
        // Кнопка входа
        this.createButton(width / 2, currentY, 'Войти', 0x07488d, async () => {
            await this.handleLogin(emailInput.inputValue, passwordInput.inputValue);
        });
        
        // Кнопка назад
        this.createBackButton();
    }
    
    createButton(x, y, text, color, callback) {
        return createRoundedRectButton(this, {
            x,
            y,
            width: 200,
            height: 45,
            radius: 14,
            fillColor: color,
            hoverFillColor: 0x6fe3b5,
            text,
            textStyle: { fontSize: '18px', fill: '#fafafa', fontStyle: 'bold' },
            onClick: callback
        });
    }
    
    // ИСПРАВЛЕННАЯ функция createInput
    createInput(x, y, width, placeholderText = 'Введите текст...') {
        const bg = this.add.rectangle(x, y, width, 35, 0xffffff, 0.9)
            .setStrokeStyle(2, 0x4ecca3)
            .setOrigin(0, 0.5);
        
        // Текст для ввода
        const text = this.add.text(x + 10, y, '', {
            fontSize: '16px',
            fill: '#000000'
        }).setOrigin(0, 0.5);
        
        // Храним значение ввода
        text.inputValue = '';
        
        // Placeholder
        const placeholder = this.add.text(x + 10, y, placeholderText, {
            fontSize: '16px',
            fill: '#999999',
            fontStyle: 'italic'
        }).setOrigin(0, 0.5);
        
        // Активация поля
        bg.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // Деактивируем предыдущее поле
                if (this.activeInput) {
                    const prevBg = this.inputFields.find(f => f.text === this.activeInput)?.bg;
                    if (prevBg) prevBg.setStrokeStyle(2, 0x4ecca3);
                }
                
                // Активируем новое
                this.activeInput = text;
                bg.setStrokeStyle(3, 0xe94560);
                placeholder.setVisible(false);
            });
        
        // Сохраняем в массив для обновления
        this.inputFields.push({ text, placeholder, bg });
        
        return text;
    }
    
    createRoleButton(x, y, label, role) {
        const btn = this.add.rectangle(x, y, 100, 35, this.formData.role === role ? 0x4ecca3 : 0x232931)
            .setStrokeStyle(2, 0xffffff)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        
        const btnText = this.add.text(x, y, label, {
            fontSize: '14px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        btn.on('pointerdown', () => {
            this.formData.role = role;
            
            // Обновляем цвета всех кнопок роли
            this.children.list.forEach(child => {
                if (child.type === 'Rectangle' && child.y === y && child.width === 100 && child.height === 35) {
                    child.setFillStyle(0x232931);
                }
            });
            btn.setFillStyle(0x4ecca3);
        });
        
        return btn;
    }
    
    createAvatarSelector(x, y) {
        const avatars = ['👩', '👨', '👧', '👦', '🧑'];
        let startX = x;
        
        avatars.forEach(avatar => {
            const btn = this.add.text(startX, y, avatar, {
                fontSize: '30px',
                backgroundColor: this.formData.avatar === avatar ? '#4ecca3' : 'transparent',
                padding: { x: 5, y: 5 }
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
            
            btn.on('pointerdown', () => {
                // Сбрасываем выделение всех аватаров
                this.children.list.forEach(child => {
                    if (child.type === 'Text' && avatars.includes(child.text)) {
                        child.setBackgroundColor('transparent');
                    }
                });
                
                // Выделяем выбранный
                btn.setBackgroundColor('#4ecca3');
                this.formData.avatar = avatar;
            });
            
            startX += 45;
        });
    }
    
    showCodeInput() {
        const { width, height } = this.cameras.main;
        
        // Создаем элементы модального окна
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0, 0)
            .setDepth(2000)
            .setInteractive();
        
        const modal = this.add.rectangle(width / 2, height / 2, 400, 200, 0x232931)
            .setStrokeStyle(2, 0x4ecca3)
            .setDepth(2001);
        
        const titleText = this.add.text(width / 2, height / 2 - 60, 'Введите код приглашения', {
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0.5).setDepth(2001);
        
        const inputBg = this.add.rectangle(width / 2, height / 2, 250, 35, 0xffffff, 0.9)
            .setStrokeStyle(2, 0x4ecca3)
            .setDepth(2001)
            .setOrigin(0.5);
        
        const codeText = this.add.text(width / 2 - 115, height / 2, '', {
            fontSize: '16px',
            fill: '#000000'
        }).setDepth(2001).setOrigin(0, 0.5);
        
        codeText.inputValue = '';
        
        inputBg.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.activeInput = codeText;
                inputBg.setStrokeStyle(3, 0xe94560);
            });
        
        // Кнопка OK
        const okBtn = this.add.text(width / 2 - 80, height / 2 + 60, 'OK', {
            fontSize: '18px',
            fill: '#ffffff',
            backgroundColor: '#4ecca3',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setDepth(2001)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            this.formData.familyCode = codeText.inputValue;
            this.formData.familyAction = 'join';
            
            // Уничтожаем модальное окно
            bg.destroy();
            modal.destroy();
            titleText.destroy();
            inputBg.destroy();
            codeText.destroy();
            okBtn.destroy();
            cancelBtn.destroy();
            
            // Обновляем кнопки
            if (this.familyButtons && this.familyButtons.length === 3) {
                this.familyButtons[0].setBackgroundColor('#232931');
                this.familyButtons[1].setBackgroundColor('#232931');
                this.familyButtons[2].setBackgroundColor('#4ecca3');
            }
            
            // Сбрасываем активный ввод
            this.activeInput = null;
        });
        
        // Кнопка Отмена
        const cancelBtn = this.add.text(width / 2 + 80, height / 2 + 60, 'Отмена', {
            fontSize: '18px',
            fill: '#ffffff',
            backgroundColor: '#e94560',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setDepth(2001)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            this.formData.familyAction = 'none';
            this.formData.familyCode = '';
            
            bg.destroy();
            modal.destroy();
            titleText.destroy();
            inputBg.destroy();
            codeText.destroy();
            okBtn.destroy();
            cancelBtn.destroy();
            
            if (this.familyButtons && this.familyButtons.length === 3) {
                this.familyButtons[0].setBackgroundColor('#4ecca3');
                this.familyButtons[1].setBackgroundColor('#232931');
                this.familyButtons[2].setBackgroundColor('#232931');
            }
            
            this.activeInput = null;
        });
    }
    
    async handleRegister(name, email, password) {
        if (!name || !email || !password) {
            this.showError('Заполните все поля');
            return;
        }
        
        try {
            const result = await api.register({
                name,
                email,
                password,
                role: this.formData.role,
                avatar: this.formData.avatar,
                familyAction: this.formData.familyAction,
                familyCode: this.formData.familyCode
            });
            
            this.showSuccess('Регистрация успешна!');
            this.time.delayedCall(1000, () => this.scene.start('MenuScene'));
            
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    async handleLogin(email, password) {
        if (!email || !password) {
            this.showError('Введите email и пароль');
            return;
        }
        
        try {
            const result = await api.login(email, password);
            this.showSuccess('Вход выполнен!');
            this.time.delayedCall(1000, () => this.scene.start('MenuScene'));
            
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    createBackButton() {
        createRoundedTextButton(this, {
            x: 80,
            y: 30,
            radius: 14,
            fillColor: 0x07488d,
            hoverFillColor: 0x6fe3b5,
            text: '← Назад',
            textStyle: { fontSize: '18px', fill: '#fafafa' },
            onClick: () => this.showMainScreen()
        });
    }
    
    showError(text) {
        if (this.errorText) {
            this.errorText.setText(text);
            this.errorText.setColor('#e94560');
        }
        this._notifier?.show(text, 'error', { color: '#e94560', fontSize: '16px', duration: 2400 });
    }
    
    showSuccess(text) {
        if (this.errorText) {
            this.errorText.setText(text);
            this.errorText.setColor('#4ecca3');
        }
        this._notifier?.show(text, 'success', { color: '#4ecca3', fontSize: '16px', duration: 1600 });
    }
    
    clearScreen() {
        while (this.children.list.length > 0) {
            const child = this.children.list[0];
            if (child === this.background) {
                this.children.moveTo(child, this.children.list.length - 1);
                if (this.children.list.length === 1) break;
                continue;
            }
            child.destroy();
        }
    }
}