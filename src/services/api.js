// src/services/api.js
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
        try {
            return userStr ? JSON.parse(userStr) : null;
        } catch {
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
        try {
            const response = await fetch(`${this.baseUrl}/tasks`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(taskData)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка создания задания:', error);
            throw error;
        }
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

    // ========== КОМНАТА (ROOM) ==========
    async saveRoom(roomData) {
        try {
            console.log('saveRoom payload:', roomData);
            const response = await fetch(`${this.baseUrl}/rooms`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(roomData)
            });
            const data = await this.handleResponse(response);
            console.log('saveRoom response:', data);
            return data;
        } catch (error) {
            console.error('Ошибка сохранения комнаты:', error);
            throw error;
        }
    }

    async getRoom(roomName = 'default') {
        try {
            const response = await fetch(`${this.baseUrl}/rooms/by-name/${roomName}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            if (response.status === 404) return null;
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка загрузки комнаты:', error);
            throw error;
        }
    }

    async getRoomsList() {
        try {
            const response = await fetch(`${this.baseUrl}/rooms/list`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Ошибка загрузки списка комнат:', error);
            return [];
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