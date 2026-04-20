import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, testConnection, pool } from './db.js';
import nodemailer from 'nodemailer';
import dns from 'dns';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

dns.setDefaultResultOrder('ipv4first');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Папки загрузок
const uploadsDir = path.join(__dirname, 'uploads');
const voiceDir = path.join(uploadsDir, 'voice');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(voiceDir)) fs.mkdirSync(voiceDir, { recursive: true });

// Multer для голосовых
const voiceStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, voiceDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}_${uuidv4()}.webm`)
});
const voiceUpload = multer({ storage: voiceStorage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

// Почта
const emailTransporter = nodemailer.createTransport({
    host: '173.194.222.109',
    port: 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000
});
const resetCodes = new Map();

// Вспомогательные функции
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}
function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Токен не предоставлен' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Недействительный токен' });
    }
}

// ========== АУТЕНТИФИКАЦИЯ ==========
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, role = 'user', avatar = '👤', familyAction = 'none', familyCode = '' } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: 'Все поля обязательны' });
        if (password.length < 3) return res.status(400).json({ error: 'Пароль минимум 3 символа' });

        const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) return res.status(400).json({ error: 'Email уже зарегистрирован' });

        const passwordHash = await bcrypt.hash(password, 10);
        const userId = generateUUID();
        let familyId = null;

        if (familyAction === 'create') {
            const inviteCode = generateInviteCode();
            familyId = generateUUID();
            await query(`INSERT INTO families (id, name, invite_code, created_by) VALUES (?, ?, ?, ?)`, [familyId, `Семья ${name}`, inviteCode, userId]);
        } else if (familyAction === 'join' && familyCode) {
            const families = await query('SELECT id FROM families WHERE invite_code = ?', [familyCode.toUpperCase()]);
            if (families.length > 0) familyId = families[0].id;
            else return res.status(400).json({ error: 'Семья не найдена' });
        }

        await query(`INSERT INTO users (id, email, password_hash, name, role, avatar, family_id, bonuses) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [userId, email, passwordHash, name, role, avatar, familyId, 0]);

        const token = jwt.sign({ id: userId, email, name, role, familyId }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({ success: true, token, user: { id: userId, name, email, role, avatar, familyId, bonuses: 0 } });
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = await query(`SELECT * FROM users WHERE email = ?`, [email]);
        if (users.length === 0) return res.status(401).json({ error: 'Неверный email или пароль' });

        const user = users[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Неверный email или пароль' });

        await query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        const token = jwt.sign({ id: user.id, email, name: user.name, role: user.role, familyId: user.family_id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.json({ success: true, token, user: { id: user.id, name: user.name, email, role: user.role, avatar: user.avatar, familyId: user.family_id, bonuses: user.bonuses } });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ========== ЧЛЕНЫ СЕМЬИ ==========
app.get('/api/families/:id/members', authenticate, async (req, res) => {
    try {
        const members = await query(`SELECT id, name, role, avatar, bonuses, last_login FROM users WHERE family_id = ? ORDER BY role, name`, [req.params.id]);
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ========== ЗАДАНИЯ ==========
app.get('/api/tasks', authenticate, async (req, res) => {
    try {
        let sql = `SELECT t.*, u.name as assigned_to_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE 1=1`;
        const params = [];
        if (req.user.familyId) { sql += ' AND t.family_id = ?'; params.push(req.user.familyId); }
        else { sql += ' AND (t.created_by = ? OR t.assigned_to = ?)'; params.push(req.user.id, req.user.id); }
        sql += ' ORDER BY t.created_at DESC';
        res.json(await query(sql, params));
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/tasks', authenticate, async (req, res) => {
    try {
        const { title, description, bonus, assignedTo, itemKey } = req.body;
        const taskId = generateUUID();
        await query(`INSERT INTO tasks (id, family_id, created_by, assigned_to, title, description, bonus, item_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [taskId, req.user.familyId, req.user.id, assignedTo, title, description, bonus || 10, itemKey]);
        const [task] = await query(`SELECT t.*, u.name as assigned_to_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.id = ?`, [taskId]);
        res.status(201).json(task);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/tasks/:id/complete', authenticate, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [tasks] = await conn.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
        if (tasks.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'Задание не найдено' }); }
        const task = tasks[0];
        if (task.status === 'completed') { await conn.rollback(); return res.status(400).json({ error: 'Уже выполнено' }); }

        await conn.query('UPDATE tasks SET status = ?, completed_at = NOW(), completed_by = ? WHERE id = ?', ['completed', req.user.id, req.params.id]);
        await conn.query('INSERT INTO bonus_history (id, user_id, family_id, amount, balance_after, type, task_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [generateUUID(), req.user.id, req.user.familyId, task.bonus, (req.user.bonuses || 0) + task.bonus, 'task_completion', task.id]);
        await conn.query('UPDATE users SET bonuses = bonuses + ? WHERE id = ?', [task.bonus, req.user.id]);
        await conn.commit();

        const [user] = await conn.query('SELECT bonuses FROM users WHERE id = ?', [req.user.id]);
        res.json({ success: true, bonus: task.bonus, newBalance: user[0].bonuses });
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        conn.release();
    }
});

// ========== ЖЕЛАНИЯ ==========
app.get('/api/wishes', authenticate, async (req, res) => {
    try {
        let sql = `SELECT w.*, u.name as created_by_name FROM wishes w LEFT JOIN users u ON w.created_by = u.id WHERE 1=1`;
        const params = [];
        if (req.user.familyId) { sql += ' AND w.family_id = ?'; params.push(req.user.familyId); }
        else { sql += ' AND w.created_by = ?'; params.push(req.user.id); }
        sql += ' ORDER BY w.created_at DESC';
        res.json(await query(sql, params));
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/wishes', authenticate, async (req, res) => {
    try {
        const { title, description, price, icon } = req.body;
        const wishId = generateUUID();
        const status = (req.user.role === 'child') ? 'pending' : 'approved';
        await query(`INSERT INTO wishes (id, family_id, created_by, title, description, price, icon, status, approved_by, approved_at, approved_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`, [wishId, req.user.familyId, req.user.id, title, description, price, icon, status, status === 'approved' ? req.user.id : null, price]);
        const [wish] = await query(`SELECT w.*, u.name as created_by_name FROM wishes w LEFT JOIN users u ON w.created_by = u.id WHERE w.id = ?`, [wishId]);
        res.status(201).json(wish);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ========== ЧАТ ==========
app.get('/api/chat', authenticate, async (req, res) => {
    try {
        const { type, withUserId } = req.query;
        if (!req.user.familyId) return res.json([]);
        let sql = `SELECT * FROM chat_messages WHERE family_id = ?`;
        const params = [req.user.familyId];
        if (type === 'private' && withUserId) {
            sql += ` AND type = 'private' AND ((user_id = ? AND recipient_id = ?) OR (user_id = ? AND recipient_id = ?))`;
            params.push(req.user.id, withUserId, withUserId, req.user.id);
        } else {
            sql += ` AND (type = 'family' OR type = 'bot')`;
        }
        sql += ` ORDER BY created_at ASC LIMIT 100`;
        res.json(await query(sql, params));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chat', authenticate, async (req, res) => {
    try {
        const { message, type, recipientId } = req.body;
        if (!message?.trim()) return res.status(400).json({ error: 'Сообщение пустое' });
        const messageId = generateUUID();
        await query(`INSERT INTO chat_messages (id, family_id, user_id, user_name, user_avatar, message, type, recipient_id, message_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'text')`, [messageId, req.user.familyId, req.user.id, req.user.name, req.user.avatar || '👤', message.trim(), type || 'family', type === 'private' ? recipientId : null]);
        const [msg] = await query('SELECT * FROM chat_messages WHERE id = ?', [messageId]);
        res.status(201).json(msg);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ========== ГОЛОСОВЫЕ ==========
app.post('/api/chat/voice', authenticate, voiceUpload.single('audio'), async (req, res) => {
    try {
        const { type = 'family', recipientId, duration } = req.body;
        if (!req.file) return res.status(400).json({ error: 'Аудиофайл не загружен' });

        const messageId = generateUUID();
        const voiceUrl = `/uploads/voice/${req.file.filename}`;

        await query(`INSERT INTO chat_messages (id, family_id, user_id, user_name, user_avatar, message, type, recipient_id, message_type, voice_url, voice_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'voice', ?, ?)`, [messageId, req.user.familyId, req.user.id, req.user.name, req.user.avatar || '👤', '🎤 Голосовое сообщение', type, type === 'private' ? recipientId : null, voiceUrl, duration || 0]);

        const [msg] = await query('SELECT * FROM chat_messages WHERE id = ?', [messageId]);
        res.status(201).json(msg);
    } catch (error) {
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ error: 'Ошибка загрузки' });
    }
});

// ========== КОМНАТЫ ==========
app.get('/api/rooms/my-rooms', authenticate, async (req, res) => {
    try {
        const rooms = await query(`SELECT * FROM rooms WHERE user_id = ? ORDER BY updated_at DESC`, [req.user.id]);
        res.json(rooms.map(r => ({ ...r, data: r.data ? JSON.parse(r.data) : { items: [] } })));
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/rooms/create', authenticate, async (req, res) => {
    try {
        const { name, background, items } = req.body;
        const roomId = generateUUID();
        await query(`INSERT INTO rooms (id, user_id, family_id, name, data, background) VALUES (?, ?, ?, ?, ?, ?)`, [roomId, req.user.id, req.user.familyId, name, JSON.stringify({ items: items || [] }), background || 'bg_default']);
        const [room] = await query('SELECT * FROM rooms WHERE id = ?', [roomId]);
        res.status(201).json({ ...room, data: JSON.parse(room.data) });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/rooms/:roomId', authenticate, async (req, res) => {
    try {
        const { roomId } = req.params;
        const [room] = await query('SELECT * FROM rooms WHERE id = ?', [roomId]);
        if (!room) return res.status(404).json({ error: 'Комната не найдена' });

        const isOwner = room.user_id === req.user.id;
        const isParent = (req.user.role === 'parent' || req.user.role === 'admin') && room.family_id === req.user.familyId;

        if (!isOwner && !isParent) return res.status(403).json({ error: 'Нет доступа' });

        res.json({
            id: room.id,
            name: room.name,
            userId: room.user_id,
            background: room.background,
            items: room.data ? JSON.parse(room.data).items : [],
            readOnly: !isOwner
        });
    } catch (error) {
        console.error('Ошибка получения комнаты:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/rooms/:roomId', authenticate, async (req, res) => {
    try {
        const { roomId } = req.params;
        const { name, background, items } = req.body;

        const [room] = await query('SELECT user_id, family_id FROM rooms WHERE id = ?', [roomId]);
        if (!room) return res.status(404).json({ error: 'Комната не найдена' });

        const isOwner = room.user_id === req.user.id;
        const isParent = (req.user.role === 'parent' || req.user.role === 'admin') && room.family_id === req.user.familyId;
        if (!isOwner && !isParent) return res.status(403).json({ error: 'Нет прав на редактирование' });

        const roomData = { items: items || [], background: background || 'bg_default' };

        await query(`UPDATE rooms SET name = ?, background = ?, data = ?, updated_at = NOW() WHERE id = ?`, [name || 'Моя комната', background || 'bg_default', JSON.stringify(roomData), roomId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка обновления комнаты:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/rooms/child-rooms/:childId', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'parent' && req.user.role !== 'admin') return res.status(403).json({ error: 'Только родители могут просматривать комнаты детей' });
        const { childId } = req.params;
        const [child] = await query('SELECT id, family_id FROM users WHERE id = ? AND role = ?', [childId, 'child']);
        if (!child) return res.status(404).json({ error: 'Ребёнок не найден' });
        if (child.family_id !== req.user.familyId) return res.status(403).json({ error: 'Ребёнок не из вашей семьи' });

        const rooms = await query(`SELECT id, name, background, data FROM rooms WHERE user_id = ? ORDER BY updated_at DESC`, [childId]);
        res.json(rooms.map(r => ({ ...r, data: r.data ? JSON.parse(r.data) : { items: [] }, readOnly: true })));
    } catch (error) {
        console.error('Ошибка получения комнат ребёнка:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ========== АВАТАР ==========
app.post('/api/users/avatar', authenticate, async (req, res) => {
    try {
        const { imageData } = req.body;
        const matches = imageData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (!matches) return res.status(400).json({ error: 'Неверный формат' });

        const filename = `${req.user.id}-${Date.now()}.${matches[1]}`;
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, Buffer.from(matches[2], 'base64'));

        const avatarPath = `/uploads/${filename}`;
        await query('UPDATE users SET avatar = ? WHERE id = ?', [avatarPath, req.user.id]);
        res.json({ success: true, avatar: avatarPath });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка загрузки' });
    }
});

// ========== БОТ: СОБЫТИЯ ==========
app.get('/api/bot/events', authenticate, async (req, res) => {
    try {
        const { since } = req.query;
        const familyId = req.user.familyId;
        if (!familyId) return res.json([]);

        const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000);

        // Задания
        let tasks = [];
        try {
            const result = await query(`
                SELECT 'task' as type, title, bonus, created_at,
                       (SELECT name FROM users WHERE id = tasks.created_by) as creator_name,
                       (SELECT name FROM users WHERE id = tasks.assigned_to) as assigned_name
                FROM tasks 
                WHERE family_id = ? AND created_at > ?
                ORDER BY created_at DESC
            `, [familyId, sinceDate]);
            tasks = Array.isArray(result) ? result : [];
        } catch (e) { console.error('Ошибка загрузки заданий для бота:', e); }

        // Желания
        let wishes = [];
        try {
            const result = await query(`
                SELECT 'wish_pending' as type, title, price, created_at,
                       (SELECT name FROM users WHERE id = wishes.created_by) as creator_name
                FROM wishes 
                WHERE family_id = ? AND status = 'pending' AND created_at > ?
            `, [familyId, sinceDate]);
            wishes = Array.isArray(result) ? result : [];
        } catch (e) { console.error('Ошибка загрузки желаний для бота:', e); }

        const events = [];
        tasks.forEach(t => {
            if (t.assigned_name) {
                events.push({
                    message: `📋 **${t.creator_name}** назначил задание **"${t.title}"** для **${t.assigned_name}** (+${t.bonus}💰)`,
                    buttons: [{ text: '📊 Статистика', action: 'stats_personal' }]
                });
            }
        });
        wishes.forEach(w => {
            events.push({
                message: `🎁 **${w.creator_name}** хочет **"${w.title}"** за ${w.price}💰. Требуется одобрение.`,
                buttons: [{ text: '✅ Одобрить', action: 'approve_wish' }]
            });
        });

        res.json(events);
    } catch (error) {
        console.error('Ошибка событий бота:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ========== ЗАПУСК СЕРВЕРА ==========
async function startServer() {
    await testConnection();
    const server = http.createServer(app);
    const io = new SocketServer(server, { cors: { origin: ['http://localhost:3000', 'http://localhost:5173'], credentials: true } });

    const BOT_ID = '00000000-0000-0000-0000-000000000001';
    await query(`INSERT IGNORE INTO users (id, email, password_hash, name, avatar, role, family_id, bonuses, created_at) VALUES (?, 'bot@homespace.local', '', '🤖 Бот-помощник', '🤖', 'bot', NULL, 0, NOW())`, [BOT_ID]);

    io.on('connection', socket => {
        console.log('🔌 Новый клиент:', socket.id);
        socket.on('join-family', data => { socket.join(`family:${data.familyId}`); socket.data = data; });

        socket.on('send-message', async data => {
            const { familyId, message, type, recipientId } = data;
            const { userId, userName, userAvatar } = socket.data || {};
            if (!userId) return;
            const msgId = generateUUID();
            await query(`INSERT INTO chat_messages (id, family_id, user_id, user_name, user_avatar, message, type, recipient_id, message_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'text')`, [msgId, familyId, userId, userName, userAvatar, message, type, recipientId]);
            const [msg] = await query('SELECT * FROM chat_messages WHERE id = ?', [msgId]);
            io.to(`family:${familyId}`).emit('new-message', msg);
        });

        socket.on('voice-message', data => { io.to(`family:${data.familyId}`).emit('new-message', data.messageData); });

        socket.on('disconnect', () => console.log('🔌 Отключён:', socket.id));
    });

    server.listen(PORT, () => console.log(`🚀 Сервер: http://localhost:${PORT}`));
}

startServer();