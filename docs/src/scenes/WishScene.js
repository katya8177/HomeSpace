// src/scenes/WishScene.js
import { api } from '../services/api.js';
import { createRoundedTextButton } from '../utils/ui.js';
import { createDisposables, createNotificationManager, createScrollArea } from '../utils/sceneUi.js';

export class WishScene extends Phaser.Scene {
    constructor() {
        super('WishScene');
        
        this.wishes = [];
        this.currentUser = null;
        this.isAdmin = false;
        this.userBonuses = 0;
        
        this.mode = 'shop';
        this.selectedIcon = '🎁';
        this.isLoading = false;
        this.wishContainer = null;
        
        this.activeInput = null;

        this._disposables = createDisposables();
        this._notifier = null;
        this._scroll = null;
    }
    
    create() {
        const { width, height } = this.cameras.main;
        
        this.loadCurrentUser();
        
        this.add.rectangle(0, 0, width, height, 0x2c3e50).setOrigin(0, 0);
        
        this.createDecorations();
        
        const title = this.add.text(width/2, 50, '🎁 Магазин желаний 🎁', {
            fontSize: '40px',
            fill: '#ffd700',
            fontStyle: 'bold',
            stroke: '#1a2a3a',
            strokeThickness: 4
        }).setOrigin(0.5);
        title.setDepth(10);
        
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
        
        this.loadingText = this.add.text(width/2, height/2, 'Загрузка...', {
            fontSize: '24px',
            fill: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);
        this.loadingText.setVisible(false);
        
        this.createUserInfo();
        this.createModeButtons();
        
        this.wishContainer = this.add.container(100, 200);
        
        this.loadWishes();
        
        this.setupKeyboard();

        this._notifier = createNotificationManager(this, { startY: 85, depth: 4000, maxVisible: 2 });
        this._disposables.add(() => this._notifier?.destroy());
        this.events.once('shutdown', () => this._disposables.run());
        this.events.once('destroy', () => this._disposables.run());
    }
    
    createDecorations() {
        const { width, height } = this.cameras.main;
        
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const star = this.add.text(x, y, '✨', {
                fontSize: `${Math.random() * 10 + 8}px`,
                fill: '#ffd700',
                alpha: 0.3
            }).setOrigin(0.5);
            
            this.tweens.add({
                targets: star,
                alpha: 0.1,
                duration: 2000 + Math.random() * 3000,
                yoyo: true,
                repeat: -1
            });
        }
    }
    
    setupKeyboard() {
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
                    this.activeInput.inputValue += key;
                    this.activeInput.setText(this.activeInput.inputValue);
                } else {
                    this.activeInput.text += key;
                }
            }
        };
        this.input.keyboard.on('keydown', keyHandler);
        this._disposables.add(() => this.input.keyboard.off('keydown', keyHandler));
    }
    
    createUserInfo() {
        const { width } = this.cameras.main;
        
        const roleText = this.currentUser?.role === 'parent' ? '👑 Родитель' : '🧒 Ребёнок';
        const userName = this.currentUser?.name || 'Гость';
        
        const userBg = this.add.rectangle(150, 35, 280, 45, 0x1a2a3a)
            .setStrokeStyle(1, 0x4ecca3)
            .setOrigin(0.5);
        
        const userInfo = this.add.text(150, 35, `${this.currentUser?.avatar || '👤'} ${userName} | ${roleText}`, {
            fontSize: '14px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        
        const bonusBg = this.add.rectangle(width - 120, 35, 180, 55, 0x1a2a3a)
            .setStrokeStyle(2, 0xffd700)
            .setOrigin(0.5);
        
        this.add.text(width - 170, 28, '💰 БОНУСЫ', {
            fontSize: '10px',
            fill: '#ffd700'
        });
        
        this.bonusText = this.add.text(width - 120, 45, `${this.userBonuses}`, {
            fontSize: '28px',
            fill: '#ffd700',
            fontStyle: 'bold'
        }).setOrigin(0.5);
    }
    
    createModeButtons() {
        const { width } = this.cameras.main;
        
        this.modeButtons = [];
        
        const modes = [
            { key: 'shop', name: '🛍️ Доступные', x: width/2 - 300, color: '#4ecca3' },
            { key: 'create', name: '✨ Новое желание', x: width/2 - 100, color: '#ffd700' },
            { key: 'history', name: '📜 История', x: width/2 + 100, color: '#4ecca3' }
        ];
        
        if (this.isAdmin) {
            modes.push({ key: 'pending', name: '⏳ На одобрении', x: width/2 + 300, color: '#e94560' });
        }
        
        modes.forEach(mode => {
            const btn = this.add.text(mode.x, 100, mode.name, {
                fontSize: '18px',
                fill: this.mode === mode.key ? mode.color : '#dddddd',
                backgroundColor: this.mode === mode.key ? '#2c3e50' : '#1a2a3a',
                padding: { x: 15, y: 10 }
            })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.mode = mode.key;
                this.loadWishes();
                
                this.modeButtons.forEach(b => {
                    b.setFill('#dddddd');
                    b.setBackgroundColor('#1a2a3a');
                });
                btn.setFill(mode.color);
                btn.setBackgroundColor('#2c3e50');
            });
            btn.setOrigin(0.5);
            this.modeButtons.push(btn);
        });
    }
    
    async loadWishes() {
        this.isLoading = true;
        this.loadingText.setVisible(true);
        
        try {
            const filters = {};
            
            if (this.mode === 'shop') {
                filters.status = 'approved';
            } else if (this.mode === 'pending' && this.isAdmin) {
                filters.status = 'pending';
            } else if (this.mode === 'history') {
                filters.status = 'purchased';
            }
            
            const wishes = await api.getWishes(filters);
            this.wishes = wishes || [];
            
            this.displayWishes();
            
        } catch (error) {
            console.error('Ошибка загрузки желаний:', error);
            this.showNotification('Ошибка загрузки', '#e94560');
            this.displayEmptyState();
        } finally {
            this.isLoading = false;
            this.loadingText.setVisible(false);
        }
    }
    
    displayWishes() {
        if (!this.wishContainer) return;
        this.wishContainer.removeAll(true);
        if (this._scroll) {
            this._scroll.destroy();
            this._scroll = null;
        }
        
        if (this.mode === 'create') {
            this.displayCreateForm();
            return;
        }
        
        let filteredWishes = [];
        
        if (this.mode === 'shop') {
            filteredWishes = this.wishes.filter(w => w.status === 'approved' && !w.purchased_by);
        } else if (this.mode === 'pending') {
            filteredWishes = this.wishes.filter(w => w.status === 'pending');
        } else if (this.mode === 'history') {
            filteredWishes = this.wishes.filter(w => w.status === 'purchased');
        }
        
        if (filteredWishes.length === 0) {
            this.displayEmptyState();
            return;
        }
        
        let y = 0;
        const cardHeight = 140;
        
        filteredWishes.forEach((wish, index) => {
            const canAfford = this.mode === 'shop' && this.userBonuses >= (wish.approved_price || wish.price);
            const isPending = wish.status === 'pending';
            const isPurchased = wish.status === 'purchased';
            
            const card = this.add.rectangle(0, y, 900, cardHeight - 10, 0x1a2a3a)
                .setStrokeStyle(2, isPending ? 0xffd700 : (canAfford ? 0x4ecca3 : 0x666666))
                .setOrigin(0, 0);
            this.wishContainer.add(card);
            
            const icon = this.add.text(25, y + 35, wish.icon || '🎁', {
                fontSize: '60px'
            });
            this.wishContainer.add(icon);
            
            const title = this.add.text(100, y + 20, wish.title, {
                fontSize: '22px',
                fill: '#ffffff',
                fontStyle: 'bold'
            });
            this.wishContainer.add(title);
            
            if (wish.description) {
                const desc = this.add.text(100, y + 50, wish.description.substring(0, 80), {
                    fontSize: '12px',
                    fill: '#aaaaaa',
                    wordWrap: { width: 500 }
                });
                this.wishContainer.add(desc);
            }
            
            const creator = this.add.text(100, y + 80, `👤 ${wish.created_by_name || 'Неизвестно'}`, {
                fontSize: '10px',
                fill: '#888888'
            });
            this.wishContainer.add(creator);
            
            const price = wish.approved_price || wish.price;
            const priceText = this.add.text(750, y + 30, `${price}💰`, {
                fontSize: '24px',
                fill: '#ffd700',
                fontStyle: 'bold'
            });
            this.wishContainer.add(priceText);
            
            if (this.mode === 'shop' && !isPurchased) {
                if (canAfford) {
                    const buyBtn = this.createButton(750, y + 80, 'Купить', 0x4ecca3, () => this.buyWish(wish));
                    this.wishContainer.add(buyBtn);
                } else {
                    const needText = this.add.text(720, y + 85, `Нужно ещё ${price - this.userBonuses}💰`, {
                        fontSize: '12px',
                        fill: '#e94560'
                    });
                    this.wishContainer.add(needText);
                }
            }
            
            if (this.mode === 'pending' && this.isAdmin) {
                const approveBtn = this.createButton(680, y + 100, '✅ Одобрить', 0x4ecca3, () => this.approveWish(wish, price));
                const rejectBtn = this.createButton(790, y + 100, '❌ Отклонить', 0xe94560, () => this.rejectWish(wish));
                this.wishContainer.add(approveBtn);
                this.wishContainer.add(rejectBtn);
                
                const priceInput = this.add.text(680, y + 55, `${price}`, {
                    fontSize: '16px',
                    fill: '#ffd700',
                    backgroundColor: '#0f0f1a',
                    padding: { x: 10, y: 5 }
                });
                priceInput.inputValue = price.toString();
                priceInput.setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => {
                        this.activeInput = priceInput;
                        priceInput.setBackgroundColor('#2c3e50');
                    });
                this.wishContainer.add(priceInput);
                
                const minusBtn = this.createButton(640, y + 55, '-', 0xe94560, () => {
                    let val = parseInt(priceInput.inputValue) || price;
                    if (val > 5) {
                        priceInput.inputValue = (val - 5).toString();
                        priceInput.setText(priceInput.inputValue);
                    }
                });
                const plusBtn = this.createButton(740, y + 55, '+', 0x4ecca3, () => {
                    let val = parseInt(priceInput.inputValue) || price;
                    priceInput.inputValue = (val + 5).toString();
                    priceInput.setText(priceInput.inputValue);
                });
                this.wishContainer.add(minusBtn);
                this.wishContainer.add(plusBtn);
            }
            
            if (this.mode === 'history') {
                const date = wish.purchased_at ? new Date(wish.purchased_at).toLocaleDateString() : 'Неизвестно';
                const dateText = this.add.text(680, y + 30, `📅 ${date}`, {
                    fontSize: '12px',
                    fill: '#888888'
                });
                this.wishContainer.add(dateText);
                
                const buyerText = this.add.text(680, y + 55, `Купил: ${wish.purchased_by_name || wish.created_by_name}`, {
                    fontSize: '12px',
                    fill: '#aaaaaa'
                });
                this.wishContainer.add(buyerText);
            }
            
            y += cardHeight;
        });

        this._scroll = createScrollArea(this, {
            x: 100,
            y: 200,
            width: 930,
            height: 560,
            content: this.wishContainer,
            wheelStep: 90
        });
        this._disposables.add(() => this._scroll?.destroy());
    }
    
    createButton(x, y, text, color, onClick) {
        const btn = this.add.text(x, y, text, {
            fontSize: '14px',
            fill: '#ffffff',
            backgroundColor: color,
            padding: { x: 12, y: 6 }
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', onClick);
        btn.setOrigin(0.5);
        return btn;
    }
    
    displayCreateForm() {
        if (!this.wishContainer) return;
        this.wishContainer.removeAll(true);
        this.activeInput = null;
        
        const formTitle = this.add.text(450, 20, '✨ Создать новое желание ✨', {
            fontSize: '28px',
            fill: '#ffd700',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.wishContainer.add(formTitle);
        
        let y = 80;
        
        // Название
        const titleLabel = this.add.text(200, y, 'Название:', { fontSize: '18px', fill: '#cccccc' });
        this.wishContainer.add(titleLabel);
        
        const titleBg = this.add.rectangle(350, y + 5, 400, 40, 0x1a2a3a)
            .setStrokeStyle(2, 0x4ecca3)
            .setOrigin(0, 0);
        this.wishContainer.add(titleBg);
        
        const titleInput = this.add.text(365, y + 12, '', { fontSize: '16px', fill: '#ffffff' });
        titleInput.inputValue = '';
        this.wishContainer.add(titleInput);
        
        titleBg.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.activeInput = titleInput;
                titleBg.setStrokeStyle(3, 0xe94560);
            });
        
        y += 60;
        
        // Описание
        const descLabel = this.add.text(200, y, 'Описание:', { fontSize: '18px', fill: '#cccccc' });
        this.wishContainer.add(descLabel);
        
        const descBg = this.add.rectangle(350, y + 5, 400, 60, 0x1a2a3a)
            .setStrokeStyle(2, 0x4ecca3)
            .setOrigin(0, 0);
        this.wishContainer.add(descBg);
        
        const descInput = this.add.text(365, y + 12, '', { fontSize: '14px', fill: '#ffffff', wordWrap: { width: 380 } });
        descInput.inputValue = '';
        this.wishContainer.add(descInput);
        
        descBg.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.activeInput = descInput;
                descBg.setStrokeStyle(3, 0xe94560);
            });
        
        y += 80;
        
        // Цена
        const priceLabel = this.add.text(200, y, 'Цена (бонусы):', { fontSize: '18px', fill: '#cccccc' });
        this.wishContainer.add(priceLabel);
        
        const priceBg = this.add.rectangle(400, y + 5, 150, 40, 0x1a2a3a)
            .setStrokeStyle(2, 0x4ecca3)
            .setOrigin(0, 0);
        this.wishContainer.add(priceBg);
        
        const priceInput = this.add.text(410, y + 12, '50', { fontSize: '18px', fill: '#ffd700' });
        priceInput.inputValue = '50';
        this.wishContainer.add(priceInput);
        
        const minusBtn = this.createButton(560, y + 22, '-', 0xe94560, () => {
            let val = parseInt(priceInput.inputValue) || 50;
            if (val > 5) {
                priceInput.inputValue = (val - 5).toString();
                priceInput.setText(priceInput.inputValue);
            }
        });
        const plusBtn = this.createButton(600, y + 22, '+', 0x4ecca3, () => {
            let val = parseInt(priceInput.inputValue) || 50;
            priceInput.inputValue = (val + 5).toString();
            priceInput.setText(priceInput.inputValue);
        });
        this.wishContainer.add(minusBtn);
        this.wishContainer.add(plusBtn);
        
        y += 70;
        
        // Иконка
        const iconLabel = this.add.text(200, y, 'Иконка:', { fontSize: '18px', fill: '#cccccc' });
        this.wishContainer.add(iconLabel);
        
        const icons = ['🎮', '🍕', '📚', '🎬', '🧸', '👕', '🚗', '🏀', '🎨', '🎵', '🐱', '🌸', '⭐', '🌈'];
        let x = 350;
        icons.forEach(icon => {
            const iconBtn = this.add.text(x, y + 5, icon, { fontSize: '32px' })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    this.selectedIcon = icon;
                    icons.forEach((_, i) => {
                        const btn = this.wishContainer.list.find(el => el.text === icons[i] && el.type === 'Text');
                        if (btn) btn.setBackgroundColor('transparent');
                    });
                    iconBtn.setBackgroundColor('#4ecca3');
                });
            this.wishContainer.add(iconBtn);
            x += 55;
        });
        
        y += 70;
        
        // Кнопка отправки
        const submitBtn = this.add.text(450, y + 20, '✨ Отправить желание ✨', {
            fontSize: '22px',
            fill: '#ffffff',
            backgroundColor: '#4ecca3',
            padding: { x: 30, y: 12 }
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', async () => {
            const title = titleInput.inputValue.trim();
            if (!title) {
                this.showNotification('Введите название желания', '#e94560');
                return;
            }
            
            await this.createWish({
                title: title,
                description: descInput.inputValue.trim(),
                price: parseInt(priceInput.inputValue) || 50,
                icon: this.selectedIcon
            });
        });
        submitBtn.setOrigin(0.5);
        this.wishContainer.add(submitBtn);
        
        const updateHandler = () => {
            if (this.activeInput === titleInput) {
                titleInput.setText(titleInput.inputValue || '');
            }
            if (this.activeInput === descInput) {
                descInput.setText(descInput.inputValue || '');
            }
        };
        this.events.on('update', updateHandler);
        this.formUpdateHandler = updateHandler;
    }
    
    displayEmptyState() {
        if (!this.wishContainer) return;
        this.wishContainer.removeAll(true);
        
        let message = '';
        if (this.mode === 'shop') message = '🎁 Нет доступных желаний 🎁';
        else if (this.mode === 'pending') message = '⏳ Нет желаний на одобрении ⏳';
        else if (this.mode === 'history') message = '📜 История покупок пуста 📜';
        
        const emptyText = this.add.text(450, 100, message, {
            fontSize: '24px',
            fill: '#888888'
        }).setOrigin(0.5);
        this.wishContainer.add(emptyText);
        
        if (this.mode === 'shop') {
            const createHint = this.add.text(450, 160, 'Создайте новое желание в разделе "Новое желание"', {
                fontSize: '14px',
                fill: '#aaaaaa'
            }).setOrigin(0.5);
            this.wishContainer.add(createHint);
        }
    }
    
    async createWish(wishData) {
        if (!this.currentUser) {
            this.showNotification('Сначала войдите в систему', '#e94560');
            return;
        }
        
        try {
            const result = await api.createWish(wishData);
            
            const message = result?.status === 'approved'
                ? '✨ Желание создано!'
                : '✨ Желание отправлено на одобрение!';
            this.showNotification(message, '#4ecca3');
            
            this.mode = 'shop';
            this.loadWishes();
            
        } catch (error) {
            console.error('Ошибка создания желания:', error);
            this.showNotification('Ошибка создания желания', '#e94560');
        }
    }
    
    async approveWish(wish, newPrice) {
        try {
            await api.approveWish(wish.id, newPrice);
            this.showNotification(`✅ Желание одобрено за ${newPrice} бонусов!`, '#4ecca3');
            this.loadWishes();
        } catch (error) {
            console.error('Ошибка одобрения:', error);
            this.showNotification('Ошибка одобрения', '#e94560');
        }
    }
    
    async rejectWish(wish) {
        try {
            await fetch(`http://localhost:3001/api/wishes/${wish.id}/reject`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('homespace_token')}`
                }
            });
            this.showNotification('❌ Желание отклонено', '#e94560');
            this.loadWishes();
        } catch (error) {
            console.error('Ошибка отклонения:', error);
            this.showNotification('Ошибка отклонения', '#e94560');
        }
    }
    
    async buyWish(wish) {
        const price = wish.approved_price || wish.price;
        
        if (this.userBonuses < price) {
            this.showNotification(`Недостаточно бонусов! Нужно ещё ${price - this.userBonuses}💰`, '#e94560');
            return;
        }
        
        try {
            const result = await api.purchaseWish(wish.id);
            
            this.userBonuses = result.newBalance;
            this.bonusText.setText(`${this.userBonuses}`);
            
            const user = api.getCurrentUser();
            if (user) {
                user.bonuses = result.newBalance;
                localStorage.setItem('homespace_currentUser', JSON.stringify(user));
            }
            
            this.showNotification(`🎉 Вы купили: ${wish.title}! 🎉`, '#ffd700');
            
            this.tweens.add({
                targets: this.bonusText,
                scale: 1.3,
                duration: 200,
                yoyo: true
            });
            
            this.loadWishes();
            
        } catch (error) {
            console.error('Ошибка покупки:', error);
            this.showNotification('Ошибка покупки', '#e94560');
        }
    }
    
    loadCurrentUser() {
        this.currentUser = api.getCurrentUser();
        this.isAdmin = this.currentUser?.role === 'parent' || this.currentUser?.role === 'admin';
        this.userBonuses = this.currentUser?.bonuses || 0;
    }
    
    showNotification(text, color = '#4ecca3') {
        const type =
            color === '#e94560' ? 'error' :
            color === '#ffd700' ? 'warning' :
            color === '#4ecca3' ? 'success' :
            'info';
        this._notifier?.show(text, type, { color, fontSize: '18px', duration: 2500 });
    }
    
    destroy() {
        if (this.formUpdateHandler) this.events.off('update', this.formUpdateHandler);
        this._disposables.run();
        super.destroy();
    }
}