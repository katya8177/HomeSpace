// src/scenes/TasksScene.js
import { api } from '../services/api.js';
import { createRoundedTextButton } from '../utils/ui.js';
import { createDisposables, createNotificationManager, createScrollArea } from '../utils/sceneUi.js';

export class TasksScene extends Phaser.Scene {
    constructor() {
        super('TasksScene');
        
        this.tasks = [];
        this.currentUser = null;
        this.isAdmin = false;
        this.filter = 'all';
        this.isLoading = false;
        this.familyMembers = [];
        
        this.taskContainer = null;
        this.statsPanel = null;
        this.filterButtons = [];
        
        this.activeInput = null;

        this._disposables = createDisposables();
        this._notifier = null;
        this._scroll = null;
    }
    
    create() {
        const { width, height } = this.cameras.main;
        
        this.loadCurrentUser();
        
        if (!this.currentUser || !localStorage.getItem('homespace_token')) {
            this.add.rectangle(0, 0, width, height, 0x7faee1).setOrigin(0, 0);
            this.add.text(width / 2, height / 2 - 40, 'Нужен вход в аккаунт', {
                fontSize: '32px',
                fill: '#ffffff',
                fontStyle: 'bold',
                stroke: '#0850ed',
                strokeThickness: 4
            }).setOrigin(0.5);
            this.add.text(width / 2, height / 2 + 10, 'Чтобы создавать и выполнять задания, войдите в систему.', {
                fontSize: '18px',
                fill: '#ffffff'
            }).setOrigin(0.5);
            this.add.text(width / 2, height / 2 + 70, 'Перейти к входу', {
                fontSize: '20px',
                fill: '#fafafa',
                backgroundColor: '#07488d',
                padding: { x: 20, y: 10 }
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('RegistrationScene'));
            return;
        }
        
        this.add.rectangle(0, 0, width, height, 0x7faee1).setOrigin(0, 0); 
        
        this.add.text(width/2, 50, 'Управление заданиями', {
            fontSize: '40px',
            fill: '#ffffff',
            fontStyle: 'bold',
            stroke: '#0850ed',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        createRoundedTextButton(this, {
            x: 80,
            y: 30,
            radius: 14,
            fillColor: 0x07488d,
            hoverFillColor: 0x6fe3b5,
            text: '← Назад',
            textStyle: { fontSize: '18px', fill: '#fafafa' },
            onClick: () => this.scene.start('MenuScene')
        });
        
        this.loadingText = this.add.text(width/2, height/2, 'Загрузка...', {
            fontSize: '24px',
            fill: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5);
        
        const refreshBtn = this.add.text(width - 120, 20, '⟳ Обновить', {
            fontSize: '18px',
            fill: '#ffffff',
            backgroundColor: '#4ecca3',
            padding: { x: 15, y: 8 },
            borderRadius: 20
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            this.loadTasks();
        });
        
        if (this.isAdmin) {
            const createBtn = this.add.text(width - 250, 20, '+ Создать', {
                fontSize: '18px',
                fill: '#ffffff',
                backgroundColor: '#0865fa',
                padding: { x: 15, y: 8 },
                borderRadius: 20
            })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.showCreateTaskModal();
            });
        }
        
        this._notifier = createNotificationManager(this, { startY: 95, depth: 4000, maxVisible: 2 });
        this._disposables.add(() => this._notifier?.destroy());
        this.events.once('shutdown', () => this._disposables.run());
        this.events.once('destroy', () => this._disposables.run());

        const keyHandler = (event) => {
            if (!this.activeInput) return;
            
            const key = event.key;
            
            if (key === 'Backspace') {
                this.activeInput.inputValue = this.activeInput.inputValue.slice(0, -1);
            } else if (key === 'Enter') {
                this.activeInput = null;
            } else if (key.length === 1 && !event.ctrlKey && !event.altKey) {
                this.activeInput.inputValue += key;
            }
        };
        this.input.keyboard.on('keydown', keyHandler);
        this._disposables.add(() => this.input.keyboard.off('keydown', keyHandler));
        
        this.loadFamilyMembers();
        this.loadTasks();
    }
    
    async loadFamilyMembers() {
        try {
            this.familyMembers = await api.getFamilyMembers();
        } catch (error) {
            console.error('Ошибка загрузки членов семьи:', error);
            this.familyMembers = [];
        }
    }
    
    async loadTasks() {
        if (!localStorage.getItem('homespace_token')) {
            this.showNotification('Войдите в систему', '#e94560');
            return;
        }
        this.isLoading = true;
        this.loadingText.setVisible(true);
        
        try {
            const filters = {};
            if (this.filter === 'completed') {
                filters.status = 'completed';
            } else if (this.filter === 'pending') {
                filters.status = 'pending';
            } else if (this.filter === 'my' && this.currentUser) {
                filters.assignedTo = this.currentUser.id;
            }
            
            const tasks = await api.getTasks(filters);
            this.tasks = tasks || [];
            
            this.renderTasks();
            this.updateStats();
            
        } catch (error) {
            console.error('Ошибка загрузки заданий:', error);
            this.showNotification('Ошибка загрузки заданий', '#e94560');
        } finally {
            this.isLoading = false;
            this.loadingText.setVisible(false);
        }
    }
    
    renderTasks() {
        if (this.taskContainer) {
            this.taskContainer.destroy();
        }
        if (this.statsPanel) {
            this.statsPanel.destroy();
        }
        if (this._scroll) {
            this._scroll.destroy();
            this._scroll = null;
        }
        
        const { width } = this.cameras.main;
        
        this.taskContainer = this.add.container(100, 150);
        
        this.createStatsPanel();
        this.createFilterButtons();
        
        let y = 0;
        
        let filteredTasks = this.tasks;
        
        if (this.filter === 'my' && this.currentUser) {
            filteredTasks = this.tasks.filter(t => 
                t.assigned_to === this.currentUser.id || t.created_by === this.currentUser.id
            );
        }
        
        if (!filteredTasks || filteredTasks.length === 0) {
            this.taskContainer.add(
                this.add.text(400, 50, 'Нет заданий', {
                    fontSize: '24px',
                    fill: '#ffffff'
                }).setOrigin(0.5)
            );
            return;
        }
        
        filteredTasks.forEach(task => {
            const bgColor = task.status === 'completed' ? 0x1a4a3a : 0x232931;
            const bg = this.add.rectangle(0, y, 700, 100, bgColor)
                .setStrokeStyle(1, task.status === 'completed' ? 0x4ecca3 : 0x666666)
                .setOrigin(0, 0);
            this.taskContainer.add(bg);
            
            const statusIcon = task.status === 'completed' ? '✓' : '⏳';
            const statusColor = task.status === 'completed' ? '#4ecca3' : '#ffd700';
            this.taskContainer.add(
                this.add.text(20, y + 15, statusIcon, {
                    fontSize: '24px',
                    fill: statusColor
                })
            );
            
            this.taskContainer.add(
                this.add.text(60, y + 10, task.title || 'Без названия', {
                    fontSize: '18px',
                    fill: '#ffffff',
                    fontStyle: 'bold'
                })
            );
            
            if (task.description) {
                this.taskContainer.add(
                    this.add.text(60, y + 35, task.description, {
                        fontSize: '14px',
                        fill: '#cccccc',
                        wordWrap: { width: 400 }
                    })
                );
            }
            
            if (task.item_name) {
                this.taskContainer.add(
                    this.add.text(60, y + 55, `📍 ${task.item_name}`, {
                        fontSize: '12px',
                        fill: '#aaaaaa'
                    })
                );
            }
            
            let assignedText = '👤 Не назначено';
            if (task.assigned_to_name) {
                assignedText = `👤 ${task.assigned_to_name}`;
            }
            this.taskContainer.add(
                this.add.text(300, y + 10, assignedText, {
                    fontSize: '14px',
                    fill: '#aaaaaa'
                })
            );
            
            this.taskContainer.add(
                this.add.text(500, y + 10, `${task.bonus || 0} бонусов`, {
                    fontSize: '18px',
                    fill: '#ffd700',
                    fontStyle: 'bold'
                })
            );
            
            if (task.created_by_name) {
                this.taskContainer.add(
                    this.add.text(500, y + 35, `от ${task.created_by_name}`, {
                        fontSize: '10px',
                        fill: '#666666'
                    })
                );
            }
            
            if (task.created_at) {
                const date = new Date(task.created_at).toLocaleDateString();
                this.taskContainer.add(
                    this.add.text(500, y + 50, date, {
                        fontSize: '10px',
                        fill: '#666666'
                    })
                );
            }
            
            if (task.status !== 'completed') {
                const canComplete = task.assigned_to === this.currentUser?.id || 
                                   !task.assigned_to || 
                                   this.isAdmin;
                
                if (canComplete) {
                    const completeBtn = this.add.text(620, y + 20, 'Выполнить', {
                        fontSize: '14px',
                        fill: '#ffffff',
                        backgroundColor: '#4ecca3',
                        padding: { x: 10, y: 5 },
                        borderRadius: 5
                    })
                    .setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => {
                        this.completeTask(task);
                    });
                    
                    this.taskContainer.add(completeBtn);
                }
            }
            
            if (this.isAdmin) {
                const deleteBtn = this.add.text(620, y + 60, 'Удалить', {
                    fontSize: '14px',
                    fill: '#e94560',
                    backgroundColor: 'rgba(233,69,96,0.2)',
                    padding: { x: 10, y: 5 },
                    borderRadius: 5
                })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    this.deleteTask(task.id);
                });
                
                this.taskContainer.add(deleteBtn);
            }
            
            y += 110;
        });

        this._scroll = createScrollArea(this, {
            x: 100,
            y: 150,
            width: 720,
            height: 600,
            content: this.taskContainer,
            wheelStep: 80
        });
        this._disposables.add(() => this._scroll?.destroy());
    }
    
    createFilterButtons() {
        const { width } = this.cameras.main;
        
        if (this.filterButtons.length) {
            this.filterButtons.forEach(btn => btn.destroy());
        }
        this.filterButtons = [];
        
        const filters = [
            { key: 'all', name: 'Все', x: width/2 - 450 },
            { key: 'my', name: 'Мои задания', x: width/2 - 250 },
            { key: 'pending', name: 'В ожидании', x: width/2 + 30 },
            { key: 'completed', name: 'Выполненные', x: width/2 + 250 }
        ];
        
        filters.forEach(filter => {
            const btn = this.add.text(filter.x, 120, filter.name, {
                fontSize: '18px',
                fill: this.filter === filter.key ? '#4ecca3' : '#ffffff',
                backgroundColor: '#232931',
                padding: { x: 15, y: 8 },
                borderRadius: 20
            })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.filter = filter.key;
                this.loadTasks();
            });
            
            this.filterButtons.push(btn);
        });
    }
    
    createStatsPanel() {
        const { width } = this.cameras.main;
        
        this.statsPanel = this.add.rectangle(width - 150, 150, 250, 180, 0x232931)
            .setStrokeStyle(5, 0x0850ed)
            .setOrigin(0.5, 0);
        
        this.add.text(width - 150, 170, 'Статистика', {
            fontSize: '20px',
            fill: '#f4f4f8'
        }).setOrigin(0.5);
        
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.status === 'completed').length;
        const pending = this.tasks.filter(t => t.status === 'pending').length;
        const myTasks = this.currentUser ? 
            this.tasks.filter(t => t.assigned_to === this.currentUser.id && t.status !== 'completed').length : 0;
        
        const totalBonuses = this.tasks
            .filter(t => t.status === 'completed')
            .reduce((sum, t) => sum + (t.bonus || 0), 0);
        
        const stats = [
            `Всего: ${total}`,
            `Выполнено: ${completed}`,
            `В ожидании: ${pending}`,
            `Мои задания: ${myTasks}`,
            `Всего бонусов: ${totalBonuses}`
        ];
        
        let y = 210;
        stats.forEach(stat => {
            this.add.text(width - 200, y, stat, {
                fontSize: '14px',
                fill: '#ffffff'
            });
            y += 25;
        });
    }
    
    updateStats() {
        if (this.statsPanel) {
            this.statsPanel.destroy();
        }
        this.createStatsPanel();
    }
    
    async completeTask(task) {
        try {
            const result = await api.completeTask(task.id);
            
            this.showNotification(`Задание выполнено! +${result.bonus} бонусов`, '#4ecca3');
            
            const syncData = JSON.parse(localStorage.getItem('homespace_tasks_sync') || '{}');
            if (syncData.itemTasks) {
                const itemTask = syncData.itemTasks.find(it => it.itemKey === task.item_key);
                if (itemTask) {
                    const taskIndex = itemTask.tasks.findIndex(t => t.id === task.id);
                    if (taskIndex !== -1) {
                        itemTask.tasks.splice(taskIndex, 1);
                    }
                }
                syncData.lastSync = Date.now();
                localStorage.setItem('homespace_tasks_sync', JSON.stringify(syncData));
            }
            
            await this.loadTasks();
            
            const user = api.getCurrentUser();
            if (user) {
                user.bonuses = result.newBalance;
                localStorage.setItem('homespace_currentUser', JSON.stringify(user));
            }
            
        } catch (error) {
            console.error('Ошибка выполнения задания:', error);
            this.showNotification('Ошибка при выполнении задания', '#e94560');
        }
    }
    
    async deleteTask(taskId) {
        if (!confirm('Удалить задание?')) return;
        
        try {
            await api.deleteTask(taskId);
            this.showNotification('Задание удалено', '#4ecca3');
            await this.loadTasks();
        } catch (error) {
            console.error('Ошибка удаления:', error);
            this.showNotification('Ошибка при удалении', '#e94560');
        }
    }
    
    showCreateTaskModal() {
        if (!this.isAdmin) {
            this.showNotification('Ребёнок не может создавать задания — только выполнять.', '#e94560');
            return;
        }
        if (!localStorage.getItem('homespace_token')) {
            this.showNotification('Войдите в систему', '#e94560');
            return;
        }
        
        const { width, height } = this.cameras.main;
        
        const modalElements = [];
        
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0, 0)
            .setDepth(2000)
            .setInteractive();
        modalElements.push(bg);
        
        const modal = this.add.rectangle(width/2, height/2, 500, 480, 0x232931)
            .setStrokeStyle(2, 0x4ecca3)
            .setDepth(2001);
        modalElements.push(modal);
        
        const title = this.add.text(width/2, height/2 - 210, 'Создать задание', {
            fontSize: '24px',
            fill: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(2001);
        modalElements.push(title);
        
        // Название
        this.add.text(width/2 - 200, height/2 - 140, 'Название:', {
            fontSize: '16px',
            fill: '#aaaaaa'
        }).setDepth(2001);
        
        const titleBg = this.add.rectangle(width/2, height/2 - 110, 400, 35, 0x16213e)
            .setStrokeStyle(1, 0x4ecca3)
            .setDepth(2001);
        modalElements.push(titleBg);
        
        const titleText = this.add.text(width/2 - 190, height/2 - 120, '', {
            fontSize: '16px',
            fill: '#ffffff'
        }).setDepth(2001);
        titleText.inputValue = '';
        modalElements.push(titleText);
        
        const titlePlaceholder = this.add.text(width/2 - 190, height/2 - 120, 'Например: Помыть посуду', {
            fontSize: '16px',
            fill: '#666666',
            fontStyle: 'italic'
        }).setDepth(2001);
        modalElements.push(titlePlaceholder);
        
        titleBg.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (this.activeInput === descText) {
                    descBg.setStrokeStyle(1, 0x4ecca3);
                }
                if (this.activeInput === itemInput) {
                    itemBg.setStrokeStyle(1, 0x4ecca3);
                }
                if (this.activeInput === assignSelect) {
                    // для select отдельно
                }
                this.activeInput = titleText;
                titleBg.setStrokeStyle(3, 0xe94560);
                titlePlaceholder.setVisible(false);
            });
        
        // Описание
        this.add.text(width/2 - 200, height/2 - 60, 'Описание:', {
            fontSize: '16px',
            fill: '#aaaaaa'
        }).setDepth(2001);
        
        const descBg = this.add.rectangle(width/2, height/2 - 30, 400, 60, 0x16213e)
            .setStrokeStyle(1, 0x4ecca3)
            .setDepth(2001);
        modalElements.push(descBg);
        
        const descText = this.add.text(width/2 - 190, height/2 - 40, '', {
            fontSize: '14px',
            fill: '#ffffff',
            wordWrap: { width: 380 }
        }).setDepth(2001);
        descText.inputValue = '';
        modalElements.push(descText);
        
        const descPlaceholder = this.add.text(width/2 - 190, height/2 - 40, 'Подробное описание (необязательно)', {
            fontSize: '14px',
            fill: '#666666',
            fontStyle: 'italic'
        }).setDepth(2001);
        modalElements.push(descPlaceholder);
        
        descBg.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (this.activeInput === titleText) {
                    titleBg.setStrokeStyle(1, 0x4ecca3);
                }
                if (this.activeInput === itemInput) {
                    itemBg.setStrokeStyle(1, 0x4ecca3);
                }
                if (this.activeInput === assignSelect) {
                    // для select отдельно
                }
                this.activeInput = descText;
                descBg.setStrokeStyle(3, 0xe94560);
                descPlaceholder.setVisible(false);
            });
        
        // Бонус
        this.add.text(width/2 - 200, height/2 + 40, 'Бонус:', {
            fontSize: '16px',
            fill: '#aaaaaa'
        }).setDepth(2001);
        
        const bonusBg = this.add.rectangle(width/2 - 50, height/2 + 70, 100, 35, 0x16213e)
            .setStrokeStyle(1, 0x4ecca3)
            .setDepth(2001);
        modalElements.push(bonusBg);
        
        const bonusText = this.add.text(width/2 - 80, height/2 + 60, '10', {
            fontSize: '16px',
            fill: '#ffd700'
        }).setDepth(2001);
        modalElements.push(bonusText);
        
        const minusBtn = this.add.text(width/2 + 60, height/2 + 60, '-', {
            fontSize: '24px',
            fill: '#ffffff',
            backgroundColor: '#e94560',
            padding: { x: 12, y: 5 },
            borderRadius: 5
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(2001)
        .on('pointerdown', () => {
            let val = parseInt(bonusText.text) || 10;
            if (val > 1) bonusText.setText(`${val - 1}`);
        });
        modalElements.push(minusBtn);
        
        const plusBtn = this.add.text(width/2 + 100, height/2 + 60, '+', {
            fontSize: '24px',
            fill: '#ffffff',
            backgroundColor: '#4ecca3',
            padding: { x: 12, y: 5 },
            borderRadius: 5
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(2001)
        .on('pointerdown', () => {
            let val = parseInt(bonusText.text) || 10;
            bonusText.setText(`${val + 1}`);
        });
        modalElements.push(plusBtn);
        
        // Предмет (опционально)
        this.add.text(width/2 - 200, height/2 + 110, 'Предмет (опционально):', {
            fontSize: '16px',
            fill: '#aaaaaa'
        }).setDepth(2001);
        
        const itemBg = this.add.rectangle(width/2, height/2 + 140, 300, 35, 0x16213e)
            .setStrokeStyle(1, 0x4ecca3)
            .setDepth(2001);
        modalElements.push(itemBg);
        
        const itemInput = this.add.text(width/2 - 140, height/2 + 130, '', {
            fontSize: '14px',
            fill: '#ffffff'
        }).setDepth(2001);
        itemInput.inputValue = '';
        modalElements.push(itemInput);
        
        const itemPlaceholder = this.add.text(width/2 - 140, height/2 + 130, 'Ключ предмета (например: chair)', {
            fontSize: '12px',
            fill: '#666666',
            fontStyle: 'italic'
        }).setDepth(2001);
        modalElements.push(itemPlaceholder);
        
        itemBg.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (this.activeInput === titleText) {
                    titleBg.setStrokeStyle(1, 0x4ecca3);
                }
                if (this.activeInput === descText) {
                    descBg.setStrokeStyle(1, 0x4ecca3);
                }
                if (this.activeInput === assignSelect) {
                    // для select отдельно
                }
                this.activeInput = itemInput;
                itemBg.setStrokeStyle(3, 0xe94560);
                itemPlaceholder.setVisible(false);
            });
        
        // Назначить члену семьи
        this.add.text(width/2 - 200, height/2 + 190, 'Назначить:', {
            fontSize: '16px',
            fill: '#aaaaaa'
        }).setDepth(2001);
        
        const assignSelect = document.createElement('select');
        assignSelect.className = 'chip';
        assignSelect.style.background = '#16213e';
        assignSelect.style.color = '#fff';
        assignSelect.style.padding = '8px';
        assignSelect.style.borderRadius = '8px';
        assignSelect.style.width = '250px';
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '— Не назначено —';
        assignSelect.appendChild(defaultOption);
        
        this.familyMembers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = `${member.avatar || '👤'} ${member.name} (${member.role === 'parent' ? 'Родитель' : 'Ребёнок'})`;
            assignSelect.appendChild(option);
        });
        
        const assignContainer = this.add.dom(width/2 + 50, height/2 + 210, assignSelect);
        assignContainer.setDepth(2001);
        modalElements.push(assignContainer);
        
        // Кнопки
        const saveBtn = this.add.text(width/2 - 80, height/2 + 270, 'Создать', {
            fontSize: '18px',
            fill: '#ffffff',
            backgroundColor: '#4ecca3',
            padding: { x: 25, y: 12 },
            borderRadius: 5
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(2001)
        .on('pointerdown', async () => {
            if (!titleText.inputValue || !titleText.inputValue.trim()) {
                this.showNotification('Введите название', '#e94560');
                return;
            }
            
            try {
                const result = await api.createTask({
                    title: titleText.inputValue.trim(),
                    description: descText.inputValue || '',
                    bonus: parseInt(bonusText.text) || 10,
                    assignedTo: assignSelect.value || null,
                    itemKey: itemInput.inputValue || null
                });
                
                if (result.item_key) {
                    const syncData = JSON.parse(localStorage.getItem('homespace_tasks_sync') || '{}');
                    if (!syncData.itemTasks) syncData.itemTasks = [];
                    
                    const itemTask = syncData.itemTasks.find(it => it.itemKey === result.item_key);
                    if (itemTask) {
                        itemTask.tasks.push(result);
                    } else {
                        syncData.itemTasks.push({
                            itemKey: result.item_key,
                            tasks: [result]
                        });
                    }
                    syncData.lastSync = Date.now();
                    localStorage.setItem('homespace_tasks_sync', JSON.stringify(syncData));
                }
                
                this.showNotification('Задание создано!', '#4ecca3');
                
                modalElements.forEach(el => el.destroy());
                this.activeInput = null;
                
                await this.loadTasks();
                
            } catch (error) {
                console.error('Ошибка создания задания:', error);
                this.showNotification('Ошибка создания: ' + (error.message || 'неизвестная ошибка'), '#e94560');
            }
        });
        modalElements.push(saveBtn);
        
        const cancelBtn = this.add.text(width/2 + 100, height/2 + 270, 'Отмена', {
            fontSize: '18px',
            fill: '#ffffff',
            backgroundColor: '#e94560',
            padding: { x: 25, y: 12 },
            borderRadius: 5
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(2001)
        .on('pointerdown', () => {
            modalElements.forEach(el => el.destroy());
            this.activeInput = null;
        });
        modalElements.push(cancelBtn);
        
        const updateHandler = () => {
            if (this.activeInput === titleText) {
                titleText.setText(titleText.inputValue || '');
                titlePlaceholder.setVisible(titleText.inputValue.length === 0);
            }
            if (this.activeInput === descText) {
                descText.setText(descText.inputValue || '');
                descPlaceholder.setVisible(descText.inputValue.length === 0);
            }
            if (this.activeInput === itemInput) {
                itemInput.setText(itemInput.inputValue || '');
                itemPlaceholder.setVisible(itemInput.inputValue.length === 0);
            }
        };
        
        this.events.on('update', updateHandler);
        
        modalElements.push({ destroy: () => this.events.off('update', updateHandler) });
    }
    
    loadCurrentUser() {
        this.currentUser = api.getCurrentUser();
        this.isAdmin = this.currentUser?.role === 'parent' || this.currentUser?.role === 'admin' || this.currentUser?.role === 'user';
    }
    
    showNotification(text, color = '#4ecca3') {
        const type =
            color === '#e94560' ? 'error' :
            color === '#ffd700' ? 'warning' :
            color === '#4ecca3' ? 'success' :
            'info';
        this._notifier?.show(text, type, { color, fontSize: '18px' });
    }
    
    destroy() {
        this._disposables.run();
        super.destroy();
    }
}