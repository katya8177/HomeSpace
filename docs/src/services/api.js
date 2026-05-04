class ApiService {
    constructor() {
        this.baseUrl = 'http://localhost:3001/api';
        this.token = localStorage.getItem('homespace_token');
    }

    // ========== БАЗОВЫЕ МЕТОДЫ ==========
    setToken(token) {
        this.token = token;
        localStorage.setItem('homespace_token', token);
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    getCurrentUser() {
        const userStr = localStorage.getItem('homespace_currentUser');
        console.log('🔍 api.getCurrentUser() ->', userStr ? 'есть данные' : 'null');
        try {
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.error('Ошибка парсинга пользователя:', error);
            return null;
        }
    }

    async handleResponse(response) {
        if (response.status === 401) {
            this.logout();
            window.location.hash = '#/registration';
            throw new Error('Сессия истекла, войдите заново');
        }
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Ошибка запроса');
        }
        return data;
    }

    // ========== АУТЕНТИФИКАЦИЯ ==========
    async register(userData) {
        try {
            const response = await fetch(`${this.baseUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка регистрации');
            }

            if (data.token) {
                this.setToken(data.token);
                if (data.user && data.user.password_hash) {
                    delete data.user.password_hash;
                }
                localStorage.setItem('homespace_currentUser', JSON.stringify(data.user));
            }

            return data;
        } catch (error) {
            console.error('Register error:', error);
            throw error;
        }
    }

    async login(email, password) {
        try {
            const response = await fetch(`${this.baseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка входа');
            }

            if (data.token) {
                this.setToken(data.token);
                if (data.user && data.user.password_hash) {
                    delete data.user.password_hash;
                }
                localStorage.setItem('homespace_currentUser', JSON.stringify(data.user));
            }

            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async requestPasswordReset(email) {
        const response = await fetch(`${this.baseUrl}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        return await this.handleResponse(response);
    }

    async resetPassword(email, code, newPassword) {
        const response = await fetch(`${this.baseUrl}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, newPassword })
        });
        return await this.handleResponse(response);
    }

    async uploadAvatar(imageData) {
        const response = await fetch(`${this.baseUrl}/users/avatar`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ imageData })
        });
        return await this.handleResponse(response);
    }

    async verifyToken() {
        if (!this.token) {
            return null;
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/auth/verify`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            const data = await response.json();
            
            if (data.success) {
                return data.user;
            }
            return null;
        } catch (error) {
            console.error('Ошибка проверки токена:', error);
            return null;
        }
    }

    logout() {
        this.token = null;
        localStorage.removeItem('homespace_token');
        localStorage.removeItem('homespace_currentUser');
    }

    // ========== ЗАДАНИЯ (TASKS) ==========
    async getTasks(filters = {}) {
        try {
            const params = new URLSearchParams(filters).toString();
            const response = await fetch(`${this.baseUrl}/tasks?${params}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка получения заданий:', error);
            throw error;
        }
    }

async createTask(taskData) {
    console.log('📤 api.createTask получил:', JSON.stringify(taskData)); // ← ДОБАВЬ ЭТО
    try {
        const response = await fetch(`${this.baseUrl}/tasks`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                title: taskData.title,
                description: taskData.description,
                bonus: taskData.bonus,
                assignedTo: taskData.assignedTo,
                itemKey: taskData.itemKey,
                itemInstanceId: taskData.itemInstanceId
            })
        });
        return await this.handleResponse(response);
    } catch (error) {
        console.error('Ошибка создания задания:', error);
        throw error;
    }
}

    // ========== АВТОЗАДАНИЯ (TASK SCHEDULES) ==========
    async getTaskSchedules() {
        const response = await fetch(`${this.baseUrl}/task-schedules`, {
            method: 'GET',
            headers: this.getHeaders()
        });
        return await this.handleResponse(response);
    }

    async createTaskSchedule(scheduleData) {
        const response = await fetch(`${this.baseUrl}/task-schedules`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(scheduleData)
        });
        return await this.handleResponse(response);
    }

    async deleteTaskSchedule(scheduleId) {
        const response = await fetch(`${this.baseUrl}/task-schedules/${scheduleId}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return await this.handleResponse(response);
    }

    async completeTask(taskId) {
        try {
            const response = await fetch(`${this.baseUrl}/tasks/${taskId}/complete`, {
                method: 'POST',
                headers: this.getHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка выполнения задания:', error);
            throw error;
        }
    }

    async deleteTask(taskId) {
        try {
            const response = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка удаления задания:', error);
            throw error;
        }
    }

    async getTasksByItem(itemKey) {
        try {
            const response = await fetch(`${this.baseUrl}/tasks?itemKey=${itemKey}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Ошибка загрузки');
            return data;
        } catch (error) {
            console.error('Ошибка получения заданий по предмету:', error);
            return [];
        }
    }

    // ========== ЖЕЛАНИЯ (WISHES) ==========
    async getWishes(filters = {}) {
        try {
            const params = new URLSearchParams(filters).toString();
            const response = await fetch(`${this.baseUrl}/wishes?${params}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка получения желаний:', error);
            throw error;
        }
    }

    async createWish(wishData) {
        try {
            const response = await fetch(`${this.baseUrl}/wishes`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(wishData)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка создания желания:', error);
            throw error;
        }
    }

    async approveWish(wishId, price) {
        try {
            const response = await fetch(`${this.baseUrl}/wishes/${wishId}/approve`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ price })
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка одобрения желания:', error);
            throw error;
        }
    }

    async purchaseWish(wishId) {
        try {
            const response = await fetch(`${this.baseUrl}/wishes/${wishId}/purchase`, {
                method: 'POST',
                headers: this.getHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка покупки желания:', error);
            throw error;
        }
    }

    // ========== ЧАТ (CHAT) ==========
    async getMessages(filters = {}) {
        try {
            const params = new URLSearchParams();
            if (filters.type) params.append('type', filters.type);
            if (filters.withUserId) params.append('withUserId', filters.withUserId);
            
            const queryString = params.toString();
            const url = `${this.baseUrl}/chat${queryString ? '?' + queryString : ''}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка загрузки');
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Ошибка получения сообщений:', error);
            return [];
        }
    }

    async sendMessage(messageData) {
        try {
            const cleanData = {
                message: messageData.message,
                type: messageData.type || 'family'
            };
            
            if (messageData.type === 'private' && messageData.recipientId) {
                cleanData.recipientId = messageData.recipientId;
            }
            
            const response = await fetch(`${this.baseUrl}/chat`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(cleanData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка отправки');
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
            throw error;
        }
    }

    // ========== КОМНАТЫ (ROOMS) ==========
    async getMyRooms() {
        try {
            const response = await fetch(`${this.baseUrl}/rooms/my-rooms`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка получения комнат:', error);
            return [];
        }
    }

    async createRoom(roomData) {
        try {
            const response = await fetch(`${this.baseUrl}/rooms/create`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(roomData)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка создания комнаты:', error);
            throw error;
        }
    }

    async getRoomById(roomId) {
        try {
            const response = await fetch(`${this.baseUrl}/rooms/${roomId}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка получения комнаты:', error);
            throw error;
        }
    }

    async getChildRooms(childId) {
        try {
            const response = await fetch(`${this.baseUrl}/rooms/child-rooms/${childId}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка получения комнат ребенка:', error);
            return [];
        }
    }

    async updateRoom(roomId, roomData) {
        try {
            const response = await fetch(`${this.baseUrl}/rooms/${roomId}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(roomData)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка обновления комнаты:', error);
            throw error;
        }
    }

    async deleteRoom(roomId) {
        try {
            const response = await fetch(`${this.baseUrl}/rooms/${roomId}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка удаления комнаты:', error);
            throw error;
        }
    }

    // ========== ЧЛЕНЫ СЕМЬИ ==========
    async getFamilyMembers() {
        try {
            const user = this.getCurrentUser();
            if (!user?.familyId) {
                console.log('Нет familyId у пользователя');
                return [];
            }
            
            console.log('Загрузка членов семьи для familyId:', user.familyId);
            
            const response = await fetch(`${this.baseUrl}/families/${user.familyId}/members`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Ошибка загрузки');
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Ошибка получения членов семьи:', error);
            return [];
        }
    }

    // ========== СЕМЬЯ (FAMILY) ==========
    async getFamily() {
        try {
            const response = await fetch(`${this.baseUrl}/family`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка получения семьи:', error);
            throw error;
        }
    }

    async createFamily(name) {
        try {
            const response = await fetch(`${this.baseUrl}/family/create`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ name })
            });
            const data = await this.handleResponse(response);
            
            if (data.token) {
                this.setToken(data.token);
            }
            const user = this.getCurrentUser();
            if (user && data.family) {
                user.family = data.family.id;
                user.familyId = data.family.id;
                localStorage.setItem('homespace_currentUser', JSON.stringify(user));
            }
            
            return data;
        } catch (error) {
            console.error('Ошибка создания семьи:', error);
            throw error;
        }
    }

    async joinFamily(code) {
        try {
            const response = await fetch(`${this.baseUrl}/family/join`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ code })
            });
            const data = await this.handleResponse(response);
            
            if (data.token) {
                this.setToken(data.token);
            }
            const user = this.getCurrentUser();
            if (user && data.family) {
                user.family = data.family.id;
                user.familyId = data.family.id;
                localStorage.setItem('homespace_currentUser', JSON.stringify(user));
            }
            
            return data;
        } catch (error) {
            console.error('Ошибка присоединения к семье:', error);
            throw error;
        }
    }
}

export const api = new ApiService();