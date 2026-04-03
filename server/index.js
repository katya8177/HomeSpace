// server/index.js
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, testConnection, pool } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'docs', 'assets', 'uploads');
const passwordResetCodes = new Map();

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use('/assets/uploads', express.static(uploadsDir));

// =====================================================
// АУТЕНТИФИКАЦИЯ
// =====================================================

// Регистрация
app.post('/api/auth/register', async (req, res) => {
    console.log('📝 Register attempt:', req.body);
    
    try {
        const { 
            name, 
            email, 
            password, 
            role = 'child', 
            avatar = '👤',
            familyAction = 'none',
            familyCode = '' 
        } = req.body;

        // Валидация
        if (!name || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Все поля обязательны' 
            });
        }

        if (password.length < 3) {
            return res.status(400).json({ 
                success: false, 
                error: 'Пароль должен быть минимум 3 символа' 
            });
        }

        if (!email.includes('@')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Некорректный email' 
            });
        }

        // Проверяем существующего пользователя
        const existingUsers = await query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Пользователь с таким email уже существует' 
            });
        }

        // Хешируем пароль
        const passwordHash = await bcrypt.hash(password, 10);
        const userId = generateUUID();

        // Обработка семьи
        let familyId = null;
        let inviteCode = null;

        if (familyAction === 'create') {
            inviteCode = generateInviteCode();
            
            // Создаём семью
            const familyUUID = generateUUID();
            await query(
                `INSERT INTO families (id, name, invite_code, created_by) 
                 VALUES (?, ?, ?, ?)`,
                [familyUUID, `Семья ${name}`, inviteCode, userId]
            );
            
            familyId = familyUUID;
            
        } else if (familyAction === 'join' && familyCode) {
            const families = await query(
                'SELECT id FROM families WHERE invite_code = ?',
                [familyCode.toUpperCase()]
            );
            
            if (families.length > 0) {
                familyId = families[0].id;
            } else {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Семья с таким кодом не найдена' 
                });
            }
        }
        
        // Если пользователь регистрируется "без семьи", создаём личное пространство (семью)
        if (familyAction === 'none' && role === 'user') {
            inviteCode = generateInviteCode();
            const personalFamilyId = generateUUID();
            await query(
                `INSERT INTO families (id, name, invite_code, created_by) 
                 VALUES (?, ?, ?, ?)`,
                [personalFamilyId, `Личное пространство ${name}`, inviteCode, userId]
            );
            familyId = personalFamilyId;
        }

        // Создаём пользователя
        await query(
            `INSERT INTO users (
                id, email, password_hash, name, role, avatar, family_id, bonuses
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, email, passwordHash, name, role, avatar, familyId, 0]
        );

        // Если создавали семью, обновляем created_by
        if (familyAction === 'create' && familyId) {
            await query(
                'UPDATE families SET created_by = ? WHERE id = ?',
                [userId, familyId]
            );
        }

        // Получаем созданного пользователя
        const newUser = await query(
            `SELECT id, email, name, role, avatar, family_id, bonuses, 
                    created_at
             FROM users WHERE id = ?`,
            [userId]
        );

        // Создаём JWT токен - ДОБАВЛЯЕМ name
        const token = jwt.sign(
            { 
                id: userId, 
                email, 
                name: name,  // <-- ДОБАВЛЯЕМ name
                role,
                familyId: familyId 
            },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Если есть семья, получаем её код
        let familyInviteCode = null;
        if (familyId) {
            const family = await query(
                'SELECT invite_code FROM families WHERE id = ?',
                [familyId]
            );
            familyInviteCode = family[0]?.invite_code;
        }

        // Отправляем успешный ответ
        res.status(201).json({
            success: true,
            message: 'Регистрация успешна',
            token,
            user: {
                id: newUser[0].id,
                name: newUser[0].name,
                email: newUser[0].email,
                role: newUser[0].role,
                avatar: newUser[0].avatar,
                familyId: newUser[0].family_id,
                familyInviteCode: familyInviteCode,
                bonuses: newUser[0].bonuses
            }
        });

        console.log(`✅ User registered: ${email} (${role})`);

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера при регистрации' 
        });
    }
});

// Вход
app.post('/api/auth/login', async (req, res) => {
    console.log('🔑 Login attempt:', req.body.email);
    
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email и пароль обязательны' 
            });
        }

        // Ищем пользователя
        const users = await query(
            `SELECT u.*, f.invite_code as family_invite_code 
             FROM users u 
             LEFT JOIN families f ON u.family_id = f.id 
             WHERE u.email = ?`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                error: 'Неверный email или пароль' 
            });
        }

        const user = users[0];

        // Проверяем пароль
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                error: 'Неверный email или пароль' 
            });
        }

        // Обновляем last_login
        await query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        // Создаём токен - ДОБАВЛЯЕМ name
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                name: user.name,  // <-- ДОБАВЛЯЕМ name
                role: user.role,
                familyId: user.family_id 
            },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Убираем пароль из ответа
        delete user.password_hash;

        res.json({
            success: true,
            message: 'Вход выполнен успешно',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                familyId: user.family_id,
                familyInviteCode: user.family_invite_code,
                bonuses: user.bonuses,
                lastLogin: user.last_login
            }
        });

        console.log(`✅ User logged in: ${email}`);

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера при входе' 
        });
    }
});

// Запрос кода восстановления пароля
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email обязателен' });
        }

        const users = await query('SELECT id, email FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            // Не раскрываем факт существования пользователя
            return res.json({ success: true, message: 'Если email существует, код отправлен' });
        }

        const code = `${Math.floor(100000 + Math.random() * 900000)}`;
        passwordResetCodes.set(email.toLowerCase(), {
            code,
            expiresAt: Date.now() + 10 * 60 * 1000
        });

        // В проекте нет настроенного почтового сервиса, поэтому код логируется
        // и может быть подключен к реальной рассылке без изменений API.
        console.log(`Password reset code for ${email}: ${code}`);

        return res.json({ success: true, message: 'Код отправлен на email' });
    } catch (error) {
        console.error('Ошибка восстановления пароля:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Подтверждение кода и смена пароля
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        if (!email || !code || !newPassword) {
            return res.status(400).json({ error: 'Недостаточно данных' });
        }
        if (newPassword.length < 3) {
            return res.status(400).json({ error: 'Пароль должен быть минимум 3 символа' });
        }

        const entry = passwordResetCodes.get(email.toLowerCase());
        if (!entry || entry.expiresAt < Date.now() || entry.code !== String(code).trim()) {
            return res.status(400).json({ error: 'Неверный или просроченный код' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await query('UPDATE users SET password_hash = ? WHERE email = ?', [passwordHash, email]);
        passwordResetCodes.delete(email.toLowerCase());

        return res.json({ success: true, message: 'Пароль обновлён' });
    } catch (error) {
        console.error('Ошибка сброса пароля:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Проверка токена
app.get('/api/auth/verify', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            error: 'Токен не предоставлен' 
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const users = await query(
            'SELECT id, email, name, role, avatar, family_id, bonuses FROM users WHERE id = ?',
            [decoded.id]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                error: 'Пользователь не найден' 
            });
        }

        res.json({
            success: true,
            user: users[0]
        });

    } catch (error) {
        res.status(401).json({ 
            success: false, 
            error: 'Недействительный токен' 
        });
    }
});

// =====================================================
// СЕМЬЯ (FAMILY)
// =====================================================

// Получить информацию о семье пользователя
app.get('/api/family', authenticate, async (req, res) => {
    try {
        if (!req.user.familyId) {
            return res.json({ success: true, family: null });
        }
        
        const families = await query(
            'SELECT id, name, invite_code, created_by, created_at FROM families WHERE id = ?',
            [req.user.familyId]
        );
        
        if (families.length === 0) {
            return res.json({ success: true, family: null });
        }
        
        res.json({ success: true, family: families[0] });
        
    } catch (error) {
        console.error('Ошибка получения семьи:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать семью
app.post('/api/family/create', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'parent' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Только родители могут создавать семьи' });
        }
        
        if (req.user.familyId) {
            return res.status(400).json({ error: 'У вас уже есть семья' });
        }
        
        const { name } = req.body;
        const familyName = name || `Семья ${req.user.name}`;
        const inviteCode = generateInviteCode();
        const familyId = generateUUID();
        
        await query(
            `INSERT INTO families (id, name, invite_code, created_by) 
             VALUES (?, ?, ?, ?)`,
            [familyId, familyName, inviteCode, req.user.id]
        );
        
        await query(
            'UPDATE users SET family_id = ? WHERE id = ?',
            [familyId, req.user.id]
        );
        
        const newToken = jwt.sign(
            { 
                id: req.user.id, 
                email: req.user.email,
                name: req.user.name,
                role: req.user.role,
                familyId: familyId 
            },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            token: newToken,
            family: {
                id: familyId,
                name: familyName,
                invite_code: inviteCode,
                created_by: req.user.id
            }
        });
        
    } catch (error) {
        console.error('Ошибка создания семьи:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Присоединиться к семье по коду
app.post('/api/family/join', authenticate, async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({ error: 'Введите код приглашения' });
        }
        
        const families = await query(
            'SELECT id, name FROM families WHERE invite_code = ?',
            [code.toUpperCase()]
        );
        
        if (families.length === 0) {
            return res.status(404).json({ error: 'Семья с таким кодом не найдена' });
        }
        
        const family = families[0];
        
        if (req.user.familyId) {
            return res.status(400).json({ error: 'Вы уже состоите в семье' });
        }
        
        await query(
            'UPDATE users SET family_id = ? WHERE id = ?',
            [family.id, req.user.id]
        );
        
        const newToken = jwt.sign(
            { 
                id: req.user.id, 
                email: req.user.email,
                name: req.user.name,
                role: req.user.role,
                familyId: family.id 
            },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            token: newToken,
            family: {
                id: family.id,
                name: family.name
            }
        });
        
    } catch (error) {
        console.error('Ошибка присоединения к семье:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// =====================================================
// ЗАДАНИЯ (TASKS)
// =====================================================

// Получить все задания семьи
app.get('/api/tasks', authenticate, async (req, res) => {
    try {
        const { status, assignedTo } = req.query;
        
        let sql = `
            SELECT t.*, 
                   u.name as assigned_to_name,
                   u.avatar as assigned_to_avatar,
                   creator.name as created_by_name,
                   f.name as item_name
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN users creator ON t.created_by = creator.id
            LEFT JOIN furniture_items f ON t.item_key = f.item_key
            WHERE t.family_id = ?
        `;
        const params = [req.user.familyId];
        
        if (status) {
            sql += ' AND t.status = ?';
            params.push(status);
        }
        
        if (assignedTo) {
            sql += ' AND t.assigned_to = ?';
            params.push(assignedTo);
        }
        
        sql += ' ORDER BY t.created_at DESC';
        
        const tasks = await query(sql, params);
        res.json(tasks);
        
    } catch (error) {
        console.error('Ошибка получения заданий:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать задание
app.post('/api/tasks', authenticate, async (req, res) => {
    try {
        if (req.user.role === 'child') {
            return res.status(403).json({ error: 'Ребёнок не может создавать задания' });
        }
        const { 
            title, 
            description, 
            bonus, 
            assignedTo, 
            itemKey,
            dueDate 
        } = req.body;

        const taskId = generateUUID();
        
        await query(
            `INSERT INTO tasks (
                id, family_id, created_by, assigned_to, 
                title, description, bonus, item_key, due_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                taskId,
                req.user.familyId,
                req.user.id,
                assignedTo || null,
                title,
                description || '',
                bonus || 10,
                itemKey || null,
                dueDate || null
            ]
        );

        const tasks = await query(
            `SELECT t.*, 
                    u.name as assigned_to_name,
                    creator.name as created_by_name
             FROM tasks t
             LEFT JOIN users u ON t.assigned_to = u.id
             LEFT JOIN users creator ON t.created_by = creator.id
             WHERE t.id = ?`,
            [taskId]
        );

        if (assignedTo) {
            await query(
                `INSERT INTO notifications (id, user_id, family_id, type, title, message, data)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    generateUUID(),
                    assignedTo,
                    req.user.familyId,
                    'task_assigned',
                    'Новое задание',
                    `Вам назначено задание: ${title}`,
                    JSON.stringify({ taskId })
                ]
            );
        }

        res.status(201).json(tasks[0]);
        
    } catch (error) {
        console.error('Ошибка создания задания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Выполнить задание
app.post('/api/tasks/:id/complete', authenticate, async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const [tasks] = await connection.query(
            'SELECT * FROM tasks WHERE id = ? AND family_id = ?',
            [req.params.id, req.user.familyId]
        );
        
        if (tasks.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Задание не найдено' });
        }
        
        const task = tasks[0];
        
        if (task.status === 'completed') {
            await connection.rollback();
            return res.status(400).json({ error: 'Задание уже выполнено' });
        }
        
        await connection.query(
            `UPDATE tasks 
             SET status = 'completed', 
                 completed_at = NOW(), 
                 completed_by = ?
             WHERE id = ?`,
            [req.user.id, req.params.id]
        );
        
        const [users] = await connection.query(
            'SELECT bonuses FROM users WHERE id = ?',
            [req.user.id]
        );
        
        const currentBonuses = users[0].bonuses;
        const bonusAmount = task.bonus || 10;
        
        await connection.query(
            `INSERT INTO bonus_history (
                id, user_id, family_id, amount, balance_after, 
                type, task_id, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                generateUUID(),
                req.user.id,
                req.user.familyId,
                bonusAmount,
                currentBonuses + bonusAmount,
                'task_completion',
                task.id,
                `Выполнено задание: ${task.title}`
            ]
        );
        
        await connection.query(
            'UPDATE users SET bonuses = bonuses + ? WHERE id = ?',
            [bonusAmount, req.user.id]
        );
        
        await connection.commit();
        
        res.json({ 
            success: true, 
            bonus: bonusAmount,
            newBalance: currentBonuses + bonusAmount
        });
        
    } catch (error) {
        await connection.rollback();
        console.error('Ошибка выполнения задания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        connection.release();
    }
});

// Удалить задание
app.delete('/api/tasks/:id', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'parent' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        
        await query(
            'DELETE FROM tasks WHERE id = ? AND family_id = ?',
            [req.params.id, req.user.familyId]
        );
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Ошибка удаления задания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// =====================================================
// ЖЕЛАНИЯ (WISHES)
// =====================================================

// Получить все желания семьи
app.get('/api/wishes', authenticate, async (req, res) => {
    try {
        const { status } = req.query;
        
        let sql = `
            SELECT w.*, 
                   u.name as created_by_name,
                   u.avatar as created_by_avatar,
                   approver.name as approved_by_name,
                   buyer.name as purchased_by_name
            FROM wishes w
            LEFT JOIN users u ON w.created_by = u.id
            LEFT JOIN users approver ON w.approved_by = approver.id
            LEFT JOIN users buyer ON w.purchased_by = buyer.id
            WHERE w.family_id = ?
        `;
        const params = [req.user.familyId];
        
        if (status) {
            sql += ' AND w.status = ?';
            params.push(status);
        }
        
        sql += ' ORDER BY w.created_at DESC';
        
        const wishes = await query(sql, params);
        res.json(wishes);
        
    } catch (error) {
        console.error('Ошибка получения желаний:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать желание
app.post('/api/wishes', authenticate, async (req, res) => {
    try {
        const { title, description, price, icon, imageUrl } = req.body;
        
        const wishId = generateUUID();
        
        await query(
            `INSERT INTO wishes (
                id, family_id, created_by, title, description, 
                price, icon, image_url, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                wishId,
                req.user.familyId,
                req.user.id,
                title,
                description || '',
                price || 50,
                icon || '🎁',
                imageUrl || null,
                req.user.role === 'parent' ? 'approved' : 'pending'
            ]
        );

        const wishes = await query(
            `SELECT w.*, u.name as created_by_name
             FROM wishes w
             LEFT JOIN users u ON w.created_by = u.id
             WHERE w.id = ?`,
            [wishId]
        );

        res.status(201).json(wishes[0]);
        
    } catch (error) {
        console.error('Ошибка создания желания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Одобрить желание
app.post('/api/wishes/:id/approve', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'parent' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        
        const { price } = req.body;
        
        await query(
            `UPDATE wishes 
             SET status = 'approved', 
                 approved_by = ?, 
                 approved_at = NOW(),
                 approved_price = ?
             WHERE id = ? AND family_id = ?`,
            [req.user.id, price || null, req.params.id, req.user.familyId]
        );

        res.json({ success: true });
        
    } catch (error) {
        console.error('Ошибка одобрения желания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Купить желание
app.post('/api/wishes/:id/purchase', authenticate, async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const [wishes] = await connection.query(
            'SELECT * FROM wishes WHERE id = ? AND family_id = ? AND status = ?',
            [req.params.id, req.user.familyId, 'approved']
        );
        
        if (wishes.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Желание не найдено или не одобрено' });
        }
        
        const wish = wishes[0];
        const wishPrice = wish.approved_price || wish.price;
        
        const [users] = await connection.query(
            'SELECT bonuses FROM users WHERE id = ?',
            [req.user.id]
        );
        
        const currentBonuses = users[0].bonuses;
        
        if (currentBonuses < wishPrice) {
            await connection.rollback();
            return res.status(400).json({ error: 'Недостаточно бонусов' });
        }
        
        await connection.query(
            `UPDATE wishes 
             SET status = 'purchased', 
                 purchased_by = ?, 
                 purchased_at = NOW()
             WHERE id = ?`,
            [req.user.id, req.params.id]
        );
        
        await connection.query(
            `INSERT INTO bonus_history (
                id, user_id, family_id, amount, balance_after, 
                type, wish_id, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                generateUUID(),
                req.user.id,
                req.user.familyId,
                -wishPrice,
                currentBonuses - wishPrice,
                'wish_purchase',
                wish.id,
                `Куплено желание: ${wish.title}`
            ]
        );
        
        await connection.query(
            'UPDATE users SET bonuses = bonuses - ? WHERE id = ?',
            [wishPrice, req.user.id]
        );
        
        await connection.commit();
        
        res.json({ 
            success: true,
            newBalance: currentBonuses - wishPrice
        });
        
    } catch (error) {
        await connection.rollback();
        console.error('Ошибка покупки желания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        connection.release();
    }
});

/// =====================================================
// ЧАТ (CHAT) - ФИНАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ
// =====================================================

// Получить сообщения чата
app.get('/api/chat', authenticate, async (req, res) => {
    try {
        const { type, withUserId, limit = 100 } = req.query;
        
        console.log('📨 Запрос сообщений:', { 
            type, 
            withUserId, 
            familyId: req.user.familyId,
            userId: req.user.id 
        });
        
        if (!req.user.familyId) {
            return res.json([]);
        }
        
        let sql = `
            SELECT id, family_id, user_id, user_name, user_avatar, 
                   message, type, recipient_id, is_read, created_at
            FROM chat_messages 
            WHERE family_id = ?
        `;
        const params = [req.user.familyId];
        
        if (type === 'private' && withUserId) {
            sql += ` AND ((user_id = ? AND recipient_id = ?) OR (user_id = ? AND recipient_id = ?))`;
            params.push(req.user.id, withUserId, withUserId, req.user.id);
        } else if (type === 'family') {
            sql += ` AND (type = 'family' OR type = 'system' OR type = 'bot') AND (recipient_id IS NULL OR recipient_id = '')`;
        }
        
        sql += ` ORDER BY created_at ASC LIMIT ?`;
        params.push(parseInt(limit));
        
        const messages = await query(sql, params);
        console.log(`✅ Найдено сообщений: ${messages.length}`);
        
        res.json(messages);
        
    } catch (error) {
        console.error('❌ Ошибка получения сообщений:', error);
        res.status(500).json({ error: error.message });
    }
});

// Отправить сообщение - ФИНАЛЬНАЯ ВЕРСИЯ
app.post('/api/chat', authenticate, async (req, res) => {
    try {
        const { message, type, recipientId } = req.body;
        
        console.log('📝 Отправка сообщения:', { 
            message: message?.substring(0, 50), 
            type, 
            recipientId,
            userId: req.user.id,
            familyId: req.user.familyId 
        });
        
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Сообщение не может быть пустым' });
        }
        
        if (!req.user.familyId) {
            return res.status(400).json({ error: 'Вы не состоите в семье' });
        }
        
        const messageId = generateUUID();
        const messageType = type || 'family';
        const finalRecipientId = (messageType === 'private' && recipientId) ? recipientId : null;
        
        // Получаем имя пользователя из базы данных, если в токене нет
        let userName = req.user.name;
        let userAvatar = req.user.avatar || '👤';
        
        if (!userName) {
            const users = await query(
                'SELECT name, avatar FROM users WHERE id = ?',
                [req.user.id]
            );
            if (users.length > 0) {
                userName = users[0].name;
                userAvatar = users[0].avatar || '👤';
                console.log('📝 Имя получено из БД:', userName);
            } else {
                userName = 'Пользователь';
            }
        }
        
        await query(
            `INSERT INTO chat_messages (
                id, family_id, user_id, user_name, user_avatar, 
                message, type, recipient_id, is_read
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                messageId,
                req.user.familyId,
                req.user.id,
                userName,
                userAvatar,
                message.trim(),
                messageType,
                finalRecipientId,
                0
            ]
        );
        
        console.log('✅ Сообщение вставлено, ID:', messageId);

        const messages = await query(
            'SELECT * FROM chat_messages WHERE id = ?',
            [messageId]
        );

        if (messages.length === 0) {
            throw new Error('Не удалось получить сохраненное сообщение');
        }

        console.log('✅ Сообщение успешно отправлено');
        res.status(201).json(messages[0]);
        
    } catch (error) {
        console.error('❌ Ошибка отправки сообщения:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера' });
    }
});
// =====================================================
// КОМНАТА (ROOM)
// =====================================================

// Сохранить комнату
app.post('/api/rooms', authenticate, async (req, res) => {
    try {
        const { name, data, width, height, gridSize } = req.body;
        const safeName = (name || 'Моя комната').trim();
        if (!data || typeof data !== 'object') {
            return res.status(400).json({ error: 'Некорректные данные комнаты' });
        }
        console.log('save room request:', {
            userId: req.user.id,
            familyId: req.user.familyId || null,
            name: safeName,
            items: Array.isArray(data?.items) ? data.items.length : 0
        });
        
        const existing = await query(
            'SELECT id FROM rooms WHERE user_id = ? AND name = ?',
            [req.user.id, safeName]
        );
        
        let roomId;
        
        if (existing.length > 0) {
            roomId = existing[0].id;
            await query(
                `UPDATE rooms 
                 SET data = ?, width = ?, height = ?, grid_size = ?, updated_at = NOW()
                 WHERE id = ?`,
                [JSON.stringify(data), width || 20, height || 15, gridSize || 64, roomId]
            );
        } else {
            roomId = generateUUID();
            await query(
                `INSERT INTO rooms (
                    id, user_id, family_id, name, data, width, height, grid_size
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    roomId,
                    req.user.id,
                    req.user.familyId || null,
                    safeName,
                    JSON.stringify(data),
                    width || 20,
                    height || 15,
                    gridSize || 64
                ]
            );
        }

        const rooms = await query(
            'SELECT * FROM rooms WHERE id = ?',
            [roomId]
        );

        console.log('save room success:', { roomId, name: safeName });
        res.json(rooms[0]);
        
    } catch (error) {
        console.error('Ошибка сохранения комнаты:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить комнату
app.get('/api/rooms/by-name/:name', authenticate, async (req, res) => {
    try {
        const rooms = await query(
            'SELECT * FROM rooms WHERE user_id = ? AND name = ?',
            [req.user.id, req.params.name]
        );
        
        if (rooms.length === 0) {
            return res.status(404).json({ error: 'Комната не найдена' });
        }
        
        res.json(rooms[0]);
        
    } catch (error) {
        console.error('Ошибка загрузки комнаты:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/rooms/list', authenticate, async (req, res) => {
    try {
        const rooms = await query(
            `SELECT id, name, updated_at, created_at
             FROM rooms
             WHERE user_id = ?
             ORDER BY updated_at DESC, created_at DESC`,
            [req.user.id]
        );
        res.json(rooms);
    } catch (error) {
        console.error('Ошибка списка комнат:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// =====================================================
// ЧЛЕНЫ СЕМЬИ
// =====================================================

// Получить членов семьи
app.get('/api/families/:id/members', authenticate, async (req, res) => {
    try {
        const members = await query(
            `SELECT id, name, role, avatar, bonuses, last_login
             FROM users
             WHERE family_id = ?
             ORDER BY 
                CASE role 
                    WHEN 'parent' THEN 1 
                    WHEN 'admin' THEN 2 
                    ELSE 3 
                END, name`,
            [req.params.id]
        );
        
        res.json(members);
        
    } catch (error) {
        console.error('Ошибка получения членов семьи:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление аватара пользователя (фото)
app.post('/api/users/avatar', authenticate, async (req, res) => {
    try {
        const { imageData } = req.body;
        if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Некорректное изображение' });
        }

        const matches = imageData.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
        if (!matches) {
            return res.status(400).json({ error: 'Поддерживаются png, jpg, webp' });
        }

        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const base64 = matches[2];
        const filename = `${req.user.id}-${Date.now()}.${ext}`;
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, Buffer.from(base64, 'base64'));

        const avatarPath = `/assets/uploads/${filename}`;
        await query('UPDATE users SET avatar = ? WHERE id = ?', [avatarPath, req.user.id]);

        return res.json({ success: true, avatar: avatarPath });
    } catch (error) {
        console.error('Ошибка загрузки аватара:', error);
        return res.status(500).json({ error: 'Ошибка загрузки аватара' });
    }
});

// =====================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =====================================================

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Токен не предоставлен' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Недействительный токен' });
    }
}

// =====================================================
// ЗАПУСК СЕРВЕРА
// =====================================================

async function startServer() {
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
        console.log('⚠️ База данных не подключена');
    }

    app.listen(PORT, () => {
        console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
        console.log(`📝 Регистрация: POST /api/auth/register`);
        console.log(`🔑 Вход: POST /api/auth/login`);
        console.log(`✅ Задания: GET/POST /api/tasks`);
        console.log(`✅ Желания: GET/POST /api/wishes`);
        console.log(`✅ Чат: GET/POST /api/chat`);
        console.log(`✅ Комната: GET/POST /api/rooms`);
    });
}

startServer();