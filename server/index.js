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
app.use('/assets/uploads', express.static(uploadsDir));

// Почта
const emailTransporter = nodemailer.createTransport({
    host: '173.194.222.109',
    port: 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
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
    console.log('📝 Register attempt:', req.body);
    
    try {
        const { 
            name, 
            email, 
            password, 
            role = 'user', 
            avatar = '👤',
            familyAction = 'none',
            familyCode = '' 
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Все поля обязательны' });
        }

        if (password.length < 3) {
            return res.status(400).json({ success: false, error: 'Пароль должен быть минимум 3 символа' });
        }

        if (!email.includes('@')) {
            return res.status(400).json({ success: false, error: 'Некорректный email' });
        }
        
        if ((role === 'parent' || role === 'child') && familyAction === 'none') {
            return res.status(400).json({ success: false, error: 'Родитель или ребенок могут зарегистрироваться только с семьей' });
        }

        if (role === 'user' && familyAction !== 'none') {
            return res.status(400).json({ success: false, error: 'Обычный пользователь может регистрироваться только без семьи' });
        }

        const existingUsers = await query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ success: false, error: 'Пользователь с таким email уже существует' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const userId = generateUUID();
        let familyId = null;
        let inviteCode = null;

        if (familyAction === 'create') {
            inviteCode = generateInviteCode();
            familyId = generateUUID();
            await query(`INSERT INTO families (id, name, invite_code, created_by) VALUES (?, ?, ?, ?)`, 
                [familyId, `Семья ${name}`, inviteCode, userId]);
        } else if (familyAction === 'join' && familyCode) {
            const families = await query('SELECT id FROM families WHERE invite_code = ?', [familyCode.toUpperCase()]);
            if (families.length > 0) familyId = families[0].id;
            else return res.status(400).json({ success: false, error: 'Семья с таким кодом не найдена' });
        }
        
        await query(`INSERT INTO users (id, email, password_hash, name, role, avatar, family_id, bonuses) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, email, passwordHash, name, role, avatar, familyId, 0]);

        if (familyAction === 'create' && familyId) {
            await query('UPDATE families SET created_by = ? WHERE id = ?', [userId, familyId]);
            await ensureParentCommonRoom({ userId, familyId });
        }

        if (familyAction === 'none' && role === 'user') {
            await ensurePersonalRoom({ userId, familyId: null, userName: name });
        } else if (familyAction === 'join' && familyId) {
            if (role === 'child') {
                await ensureChildFamilyRooms({ userId, familyId, userName: name });
            } else if (role === 'parent' || role === 'admin') {
                await ensureParentCommonRoom({ userId, familyId });
            }
        }

        const newUser = await query(`SELECT id, email, name, role, avatar, family_id, bonuses, created_at FROM users WHERE id = ?`, [userId]);

        const token = jwt.sign({ id: userId, email, name, role, familyId }, process.env.JWT_SECRET, { expiresIn: '30d' });

        let familyInviteCode = null;
        if (familyId) {
            const family = await query('SELECT invite_code FROM families WHERE id = ?', [familyId]);
            familyInviteCode = family[0]?.invite_code;
        }

        res.status(201).json({
            success: true, message: 'Регистрация успешна', token,
            user: {
                id: newUser[0].id, name: newUser[0].name, email: newUser[0].email,
                role: newUser[0].role, avatar: newUser[0].avatar,
                familyId: newUser[0].family_id, familyInviteCode, bonuses: newUser[0].bonuses
            }
        });

        console.log(`✅ User registered: ${email} (${role})`);

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера при регистрации' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    console.log('🔑 Login attempt:', req.body.email);
    
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email и пароль обязательны' });
        }

        const users = await query(`SELECT u.*, f.invite_code as family_invite_code FROM users u LEFT JOIN families f ON u.family_id = f.id WHERE u.email = ?`, [email]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
        }

        await query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        
        if (user.family_id && (user.role === 'parent' || user.role === 'admin')) {
            await ensureParentCommonRoom({ userId: user.id, familyId: user.family_id });
        }

        const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, familyId: user.family_id }, 
            process.env.JWT_SECRET, { expiresIn: '30d' });

        delete user.password_hash;

        res.json({
            success: true, message: 'Вход выполнен успешно', token,
            user: {
                id: user.id, name: user.name, email: user.email, role: user.role,
                avatar: user.avatar, familyId: user.family_id,
                familyInviteCode: user.family_invite_code, bonuses: user.bonuses, lastLogin: user.last_login
            }
        });

        console.log(`✅ User logged in: ${email}`);

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера при входе' });
    }
});

app.get('/api/auth/verify', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Токен не предоставлен' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const users = await query('SELECT id, email, name, role, avatar, family_id, bonuses FROM users WHERE id = ?', [decoded.id]);
        if (users.length === 0) return res.status(401).json({ success: false, error: 'Пользователь не найден' });
        res.json({ success: true, user: users[0] });
    } catch (error) {
        res.status(401).json({ success: false, error: 'Недействительный токен' });
    }
});
// =====================================================
// СЕМЬЯ (FAMILY)
// =====================================================

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
            `INSERT INTO families (id, name, invite_code, created_by) VALUES (?, ?, ?, ?)`,
            [familyId, familyName, inviteCode, req.user.id]
        );
        
        await query('UPDATE users SET family_id = ? WHERE id = ?', [familyId, req.user.id]);
        await ensureParentCommonRoom({ userId: req.user.id, familyId });
        
        const newToken = jwt.sign(
            { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role, familyId },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            token: newToken,
            family: { id: familyId, name: familyName, invite_code: inviteCode, created_by: req.user.id }
        });
        
    } catch (error) {
        console.error('Ошибка создания семьи:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/family/join', authenticate, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Введите код приглашения' });
        
        const families = await query('SELECT id, name FROM families WHERE invite_code = ?', [code.toUpperCase()]);
        if (families.length === 0) return res.status(404).json({ error: 'Семья с таким кодом не найдена' });
        
        const family = families[0];
        if (req.user.familyId) return res.status(400).json({ error: 'Вы уже состоите в семье' });
        
        await query('UPDATE users SET family_id = ? WHERE id = ?', [family.id, req.user.id]);

        if (req.user.role === 'child') {
            await ensureChildFamilyRooms({ userId: req.user.id, familyId: family.id, userName: req.user.name });
        } else if (req.user.role === 'parent' || req.user.role === 'admin') {
            await ensureParentCommonRoom({ userId: req.user.id, familyId: family.id });
        }
        
        const newToken = jwt.sign(
            { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role, familyId: family.id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({ success: true, token: newToken, family: { id: family.id, name: family.name } });
        
    } catch (error) {
        console.error('Ошибка присоединения к семье:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// =====================================================
// ЗАДАНИЯ (TASKS)
// =====================================================

let taskSchedulesV2Ready = false;
async function ensureTaskSchedulesV2Table() {
    if (taskSchedulesV2Ready) return;
    await query(`
        CREATE TABLE IF NOT EXISTS task_schedules_v2 (
            id VARCHAR(36) PRIMARY KEY,
            family_id VARCHAR(36) NULL,
            created_by VARCHAR(36) NOT NULL,
            assigned_to VARCHAR(36) NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            bonus INT DEFAULT 10,
            item_key VARCHAR(255) NULL,
            item_instance_id VARCHAR(255) NULL,
            schedule_type VARCHAR(16) NOT NULL,
            time_of_day VARCHAR(5) NULL,
            days_of_week_json TEXT NULL,
            run_at DATETIME NULL,
            timezone_offset_min INT DEFAULT 0,
            next_run_at DATETIME NOT NULL,
            last_run_at DATETIME NULL,
            active TINYINT(1) DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    taskSchedulesV2Ready = true;
}

function parseTimeOfDay(value) {
    const m = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return { hh, mm, str: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
}

function normalizeDaysOfWeek(days) {
    if (!Array.isArray(days)) return [];
    const out = [];
    for (const d of days) {
        const n = Number(d);
        if (Number.isFinite(n) && n >= 0 && n <= 6) out.push(n);
    }
    return Array.from(new Set(out)).sort((a, b) => a - b);
}

function computeNextRunAtV2({ scheduleType, timeOfDay, daysOfWeek, runAt, timezoneOffsetMin }) {
    const offset = Number.isFinite(Number(timezoneOffsetMin)) ? Number(timezoneOffsetMin) : 0;
    const nowUtc = new Date();
    const nowLocal = new Date(nowUtc.getTime() + offset * 60_000);

    if (scheduleType === 'once') {
        const dt = runAt ? new Date(runAt) : null;
        if (!dt || Number.isNaN(dt.getTime())) return null;
        // runAt приходит в ISO или "YYYY-MM-DDTHH:mm", считаем как локальное время клиента
        const localTarget = dt;
        const utcTarget = new Date(localTarget.getTime() - offset * 60_000);
        if (utcTarget <= nowUtc) return null;
        return utcTarget;
    }

    const t = parseTimeOfDay(timeOfDay);
    if (!t) return null;

    if (scheduleType === 'daily') {
        const candLocal = new Date(nowLocal);
        candLocal.setSeconds(0, 0);
        candLocal.setHours(t.hh, t.mm, 0, 0);
        if (candLocal <= nowLocal) candLocal.setDate(candLocal.getDate() + 1);
        return new Date(candLocal.getTime() - offset * 60_000);
    }

    if (scheduleType === 'weekly') {
        const days = normalizeDaysOfWeek(daysOfWeek);
        if (!days.length) return null;

        // перебираем ближайшие 7 дней и выбираем первый подходящий
        for (let i = 0; i < 14; i++) {
            const candLocal = new Date(nowLocal);
            candLocal.setDate(candLocal.getDate() + i);
            candLocal.setSeconds(0, 0);
            candLocal.setHours(t.hh, t.mm, 0, 0);
            const dow = candLocal.getDay(); // 0..6
            if (!days.includes(dow)) continue;
            if (candLocal <= nowLocal) continue;
            return new Date(candLocal.getTime() - offset * 60_000);
        }
        return null;
    }

    return null;
}

app.get('/api/tasks', authenticate, async (req, res) => {
    try {
        const { status, assignedTo, createdBy, itemKey } = req.query;
        
        let sql = `SELECT t.*, 
                   u.name as assigned_to_name, u.avatar as assigned_to_avatar,
                   creator.name as created_by_name,
                   f.name as item_name
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN users creator ON t.created_by = creator.id
            LEFT JOIN furniture_items f ON t.item_key = f.item_key
            WHERE 1=1`;
        const params = [];
        
        if (!req.user.familyId) {
            sql += ' AND (t.created_by = ? OR t.assigned_to = ?)';
            params.push(req.user.id, req.user.id);
        } else {
            sql += ' AND t.family_id = ?';
            params.push(req.user.familyId);
        }
        
        if (status) { sql += ' AND t.status = ?'; params.push(status); }
        if (assignedTo) { sql += ' AND t.assigned_to = ?'; params.push(assignedTo); }
        if (createdBy) { sql += ' AND t.created_by = ?'; params.push(createdBy); }  // ← ДОБАВИТЬ
        if (itemKey) { sql += ' AND t.item_key = ?'; params.push(itemKey); }
        
        sql += ' ORDER BY t.created_at DESC';
        
        const tasks = await query(sql, params);
        res.json(tasks);
    } catch (error) {
        console.error('Ошибка получения заданий:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/tasks', authenticate, async (req, res) => {
    try {
        if (req.user.role === 'child') {
            return res.status(403).json({ error: 'Ребёнок не может создавать задания' });
        }
        
        const { title, description, bonus, assignedTo, itemKey, itemInstanceId, dueDate } = req.body;

        console.log('📥 СЕРВЕР ПОЛУЧИЛ item_instance_id:', itemInstanceId);  // ← ДОБАВЬ

        const taskId = generateUUID();
        const familyId = req.user.familyId || null;
        
        await query(
            `INSERT INTO tasks (id, family_id, created_by, assigned_to, title, description, bonus, item_key, item_instance_id, due_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [taskId, familyId, req.user.id, assignedTo || null, title, description || '', bonus || 10, 
             itemKey || null, itemInstanceId || null, dueDate || null]
        );

        const tasks = await query(
            `SELECT t.*, u.name as assigned_to_name, creator.name as created_by_name
             FROM tasks t
             LEFT JOIN users u ON t.assigned_to = u.id
             LEFT JOIN users creator ON t.created_by = creator.id
             WHERE t.id = ?`,
            [taskId]
        );

        console.log('📥 СОХРАНЕНО В БД item_instance_id:', tasks[0]?.item_instance_id);  // ← ДОБАВЬ

        res.status(201).json(tasks[0]);
        
    } catch (error) {
        console.error('Ошибка создания задания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// =====================================================
// АВТОЗАДАНИЯ (TASK SCHEDULES)
// =====================================================
app.get('/api/task-schedules', authenticate, async (req, res) => {
    try {
        try { await ensureTaskSchedulesV2Table(); }
        catch (e) {
            console.error('Ошибка ensureTaskSchedulesV2Table (GET):', e);
            return res.status(500).json({ error: `Не удалось подготовить таблицу автозаданий: ${e?.message || e}` });
        }
        const params = [];
        let sql = `SELECT * FROM task_schedules_v2 WHERE schedule_type IS NOT NULL`;
        if (req.user.familyId) {
            sql += ` AND family_id = ?`;
            params.push(req.user.familyId);
        } else {
            sql += ` AND (created_by = ? OR assigned_to = ?)`;
            params.push(req.user.id, req.user.id);
        }
        sql += ` ORDER BY created_at DESC`;
        const rows = await query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Ошибка получения автозаданий:', error);
        res.status(500).json({ error: error?.message || 'Ошибка сервера' });
    }
});

app.post('/api/task-schedules', authenticate, async (req, res) => {
    try {
        if (req.user.role === 'child') {
            return res.status(403).json({ error: 'Ребёнок не может создавать автозадания' });
        }
        try { await ensureTaskSchedulesV2Table(); }
        catch (e) {
            console.error('Ошибка ensureTaskSchedulesV2Table (POST):', e);
            return res.status(500).json({ error: `Не удалось подготовить таблицу автозаданий: ${e?.message || e}` });
        }

        const {
            title,
            description,
            bonus,
            assignedTo,
            itemKey,
            itemInstanceId,
            scheduleType,
            timeOfDay,
            daysOfWeek,
            runAt,
            timezoneOffsetMin
        } = req.body || {};

        const allowed = ['daily', 'weekly', 'once'];
        if (!allowed.includes(scheduleType)) return res.status(400).json({ error: 'Некорректный scheduleType' });

        const next = computeNextRunAtV2({ scheduleType, timeOfDay, daysOfWeek, runAt, timezoneOffsetMin });
        if (!next) return res.status(400).json({ error: 'Некорректные параметры расписания' });

        const scheduleId = generateUUID();
        const familyId = req.user.familyId || null;

        await query(
            `INSERT INTO task_schedules_v2
(id, family_id, created_by, assigned_to, title, description, bonus, item_key, item_instance_id, schedule_type, days_of_week, run_at, run_date)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                scheduleId, familyId, req.user.id, assignedTo || null,
    title, description || '', bonus || 10,
    itemKey || null, itemInstanceId || null,
    scheduleType,
    scheduleType === 'weekly' ? normalizeDaysOfWeek(daysOfWeek).join(',') : null,
    scheduleType === 'once' ? new Date(runAt) : parseTimeOfDay(timeOfDay)?.str || '09:00:00',
    scheduleType === 'once' ? new Date(runAt).toISOString().split('T')[0] : null
            ]
        );

        const rows = await query('SELECT * FROM task_schedules_v2 WHERE id = ?', [scheduleId]);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Ошибка создания автозадания:', error);
        res.status(500).json({ error: error?.message || 'Ошибка сервера' });
    }
});

app.delete('/api/task-schedules/:id', authenticate, async (req, res) => {
    try {
        try { await ensureTaskSchedulesV2Table(); }
        catch (e) {
            console.error('Ошибка ensureTaskSchedulesV2Table (DELETE):', e);
            return res.status(500).json({ error: `Не удалось подготовить таблицу автозаданий: ${e?.message || e}` });
        }
        const scheduleId = req.params.id;
        let sql = `UPDATE task_schedules_v2 SET active = 0 WHERE id = ?`;
        const params = [scheduleId];
        if (req.user.familyId) {
            sql += ` AND family_id = ?`;
            params.push(req.user.familyId);
        } else {
            sql += ` AND created_by = ?`;
            params.push(req.user.id);
        }
        const result = await query(sql, params);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Автозадание не найдено' });
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка удаления автозадания:', error);
        res.status(500).json({ error: error?.message || 'Ошибка сервера' });
    }
});

app.post('/api/tasks/:id/complete', authenticate, async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        let sql = 'SELECT * FROM tasks WHERE id = ?';
        let params = [req.params.id];
        
        if (req.user.familyId) {
            sql += ' AND family_id = ?';
            params.push(req.user.familyId);
        } else {
            sql += ' AND (created_by = ? OR assigned_to = ?)';
            params.push(req.user.id, req.user.id);
        }
        
        const [tasks] = await connection.query(sql, params);
        
        if (tasks.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Задание не найдено' });
        }
        
        const task = tasks[0];
        
        if (task.status === 'completed') {
            await connection.rollback();
            return res.status(400).json({ error: 'Задание уже выполнено' });
        }
        
        if (task.assigned_to !== req.user.id && task.created_by !== req.user.id) {
            await connection.rollback();
            return res.status(403).json({ error: 'Вы не можете выполнить это задание' });
        }
        
        await connection.query(
            `UPDATE tasks SET status = 'completed', completed_at = NOW(), completed_by = ? WHERE id = ?`,
            [req.user.id, req.params.id]
        );
        
        const [users] = await connection.query('SELECT bonuses FROM users WHERE id = ?', [req.user.id]);
        const currentBonuses = users[0].bonuses;
        const bonusAmount = task.bonus || 10;
        
        await connection.query(
            `INSERT INTO bonus_history (id, user_id, family_id, amount, balance_after, type, task_id, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [generateUUID(), req.user.id, req.user.familyId, bonusAmount, currentBonuses + bonusAmount,
             'task_completion', task.id, `Выполнено задание: ${task.title}`]
        );
        
        await connection.commit();
        
        const [updatedUsers] = await connection.query('SELECT bonuses FROM users WHERE id = ?', [req.user.id]);
        const newBalance = updatedUsers[0]?.bonuses || currentBonuses + bonusAmount;
        
        res.json({ success: true, bonus: bonusAmount, newBalance: newBalance });
        
    } catch (error) {
        await connection.rollback();
        console.error('Ошибка выполнения задания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        connection.release();
    }
});

app.delete('/api/tasks/:id', authenticate, async (req, res) => {
    try {
        let sql = 'DELETE FROM tasks WHERE id = ?';
        let params = [req.params.id];
        
        if (req.user.role !== 'parent' && req.user.role !== 'admin') {
            sql += ' AND assigned_to = ? AND status = "completed"';
            params.push(req.user.id);
        } else {
            sql += ' AND family_id = ?';
            params.push(req.user.familyId);
        }
        
        const result = await query(sql, params);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Задание не найдено или нет прав для удаления' });
        }
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Ошибка удаления задания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// =====================================================
// ЖЕЛАНИЯ (WISHES)
// =====================================================

app.get('/api/wishes', authenticate, async (req, res) => {
    try {
        const { status } = req.query;
        
        let sql = `
            SELECT w.*, 
                   u.name as created_by_name, u.avatar as created_by_avatar,
                   approver.name as approved_by_name,
                   buyer.name as purchased_by_name
            FROM wishes w
            LEFT JOIN users u ON w.created_by = u.id
            LEFT JOIN users approver ON w.approved_by = approver.id
            LEFT JOIN users buyer ON w.purchased_by = buyer.id
            WHERE 1=1
        `;
        const params = [];
        
        if (req.user.familyId) {
            if (req.user.role === 'parent' || req.user.role === 'admin') {
                sql += ' AND w.family_id = ?';
                params.push(req.user.familyId);
            } else {
                sql += ' AND w.created_by = ?';
                params.push(req.user.id);
            }
        } else {
            sql += ' AND w.created_by = ?';
            params.push(req.user.id);
        }
        
        if (status) { sql += ' AND w.status = ?'; params.push(status); }
        
        sql += ' ORDER BY w.created_at DESC';
        
        const wishes = await query(sql, params);
        res.json(wishes);
        
    } catch (error) {
        console.error('Ошибка получения желаний:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/wishes', authenticate, async (req, res) => {
    try {
        const { title, description, price, icon, imageUrl } = req.body;
        
        const wishId = generateUUID();
        
        let status = 'approved';
        let approvedBy = null;
        let approvedAt = null;
        let approvedPrice = null;
        
        if (req.user.familyId && req.user.role === 'child') {
            status = 'pending';
        } else if (req.user.familyId && (req.user.role === 'parent' || req.user.role === 'admin')) {
            status = 'approved';
            approvedBy = req.user.id;
            approvedAt = new Date();
            approvedPrice = price || 50;
        } else if (!req.user.familyId) {
            status = 'approved';
            approvedBy = req.user.id;
            approvedAt = new Date();
            approvedPrice = price || 50;
        }
        
        await query(
            `INSERT INTO wishes (id, family_id, created_by, title, description, price, icon, image_url, status, approved_by, approved_at, approved_price)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [wishId, req.user.familyId || null, req.user.id, title, description || '', price || 50, 
             icon || '🎁', imageUrl || null, status, approvedBy, approvedAt, approvedPrice]
        );

        const wishes = await query(
            `SELECT w.*, u.name as created_by_name FROM wishes w LEFT JOIN users u ON w.created_by = u.id WHERE w.id = ?`,
            [wishId]
        );

        res.status(201).json(wishes[0]);
        
    } catch (error) {
        console.error('Ошибка создания желания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/wishes/:id/approve', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'parent' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        
        const { price } = req.body;
        
        await query(
            `UPDATE wishes SET status = 'approved', approved_by = ?, approved_at = NOW(), approved_price = ?
             WHERE id = ? AND family_id = ?`,
            [req.user.id, price || null, req.params.id, req.user.familyId]
        );

        res.json({ success: true });
        
    } catch (error) {
        console.error('Ошибка одобрения желания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/wishes/:id/reject', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'parent' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }
        
        await query(`UPDATE wishes SET status = 'rejected' WHERE id = ? AND family_id = ?`, 
            [req.params.id, req.user.familyId]);

        res.json({ success: true });
        
    } catch (error) {
        console.error('Ошибка отклонения желания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

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
        
        const [users] = await connection.query('SELECT bonuses FROM users WHERE id = ?', [req.user.id]);
        const currentBonuses = users[0].bonuses;
        
        if (currentBonuses < wishPrice) {
            await connection.rollback();
            return res.status(400).json({ error: 'Недостаточно бонусов' });
        }
        
        await connection.query(
            `UPDATE wishes SET status = 'purchased', purchased_by = ?, purchased_at = NOW() WHERE id = ?`,
            [req.user.id, req.params.id]
        );
        
        await connection.query(
            `INSERT INTO bonus_history (id, user_id, family_id, amount, balance_after, type, wish_id, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [generateUUID(), req.user.id, req.user.familyId, -wishPrice, currentBonuses - wishPrice,
             'wish_purchase', wish.id, `Куплено желание: ${wish.title}`]
        );
        
        await connection.query('UPDATE users SET bonuses = bonuses - ? WHERE id = ?', [wishPrice, req.user.id]);
        
        await connection.commit();
        
        res.json({ success: true, newBalance: currentBonuses - wishPrice });
        
    } catch (error) {
        await connection.rollback();
        console.error('Ошибка покупки желания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    } finally {
        connection.release();
    }
});

app.delete('/api/wishes/:id', authenticate, async (req, res) => {
    try {
        const wishId = req.params.id;
        let sql = 'DELETE FROM wishes WHERE id = ?';
        const params = [wishId];
        
        // Для родителя/админа — можно удалять любые желания в семье
        if (req.user.role === 'parent' || req.user.role === 'admin') {
            if (req.user.familyId) {
                sql += ' AND family_id = ?';
                params.push(req.user.familyId);
            }
            // Если нет семьи, то просто удаляем по id (родитель без семьи)
        } else {
            // Обычный пользователь может удалять только свои желания
            sql += ' AND created_by = ?';
            params.push(req.user.id);
        }
        
        const result = await query(sql, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Желание не найдено или нет прав на удаление' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка удаления желания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
// =====================================================
// ЧАТ (CHAT)
// =====================================================

app.get('/api/chat', authenticate, async (req, res) => {
    try {
        const { type, withUserId, limit = 100 } = req.query;
        
        if (!req.user.familyId) return res.json([]);
        
        let sql = `
            SELECT id, family_id, user_id, user_name, user_avatar, message, type, recipient_id, is_read, 
                   message_type, voice_url, voice_duration, created_at
            FROM chat_messages 
            WHERE family_id = ?
        `;
        const params = [req.user.familyId];
        
        if (type === 'private' && withUserId) {
            sql += ` AND type = 'private' AND ((user_id = ? AND recipient_id = ?) OR (user_id = ? AND recipient_id = ?))`;
            params.push(req.user.id, withUserId, withUserId, req.user.id);
        } else if (type === 'family') {
            sql += ` AND (type = 'family' OR type = 'system' OR type = 'bot') AND (recipient_id IS NULL OR recipient_id = '')`;
        }
        
        sql += ` ORDER BY created_at ASC LIMIT ?`;
        params.push(parseInt(limit));
        
        const messages = await query(sql, params);
        res.json(messages);
        
    } catch (error) {
        console.error('❌ Ошибка получения сообщений:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chat', authenticate, async (req, res) => {
    try {
        const { message, type, recipientId } = req.body;
        
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Сообщение не может быть пустым' });
        }
        
        if (!req.user.familyId) {
            return res.status(400).json({ error: 'Вы не состоите в семье' });
        }
        
        const messageId = generateUUID();
        const messageType = type || 'family';
        const finalRecipientId = (messageType === 'private' && recipientId) ? recipientId : null;
        
        let userName = req.user.name;
        let userAvatar = req.user.avatar || '👤';
        
        if (!userName) {
            const users = await query('SELECT name, avatar FROM users WHERE id = ?', [req.user.id]);
            if (users.length > 0) {
                userName = users[0].name;
                userAvatar = users[0].avatar || '👤';
            } else {
                userName = 'Пользователь';
            }
        }
        
        await query(
            `INSERT INTO chat_messages (id, family_id, user_id, user_name, user_avatar, message, type, recipient_id, is_read, message_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'text')`,
            [messageId, req.user.familyId, req.user.id, userName, userAvatar, message.trim(), messageType, finalRecipientId, 0]
        );

        const messages = await query('SELECT * FROM chat_messages WHERE id = ?', [messageId]);
        res.status(201).json(messages[0]);
        
    } catch (error) {
        console.error('❌ Ошибка отправки сообщения:', error);
        res.status(500).json({ error: error.message || 'Ошибка сервера' });
    }
});

// ========== ГОЛОСОВЫЕ СООБЩЕНИЯ ==========
app.post('/api/chat/voice', authenticate, voiceUpload.single('audio'), async (req, res) => {
    try {
        const { type = 'family', recipientId, duration } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'Аудиофайл не загружен' });
        }
        
        if (!req.user.familyId) {
            return res.status(400).json({ error: 'Вы не состоите в семье' });
        }
        
        const messageId = generateUUID();
        const voiceUrl = `/uploads/voice/${req.file.filename}`;
        
        let userName = req.user.name;
        let userAvatar = req.user.avatar || '👤';
        
        if (!userName) {
            const users = await query('SELECT name, avatar FROM users WHERE id = ?', [req.user.id]);
            if (users.length > 0) {
                userName = users[0].name;
                userAvatar = users[0].avatar || '👤';
            }
        }
        
        await query(
            `INSERT INTO chat_messages (id, family_id, user_id, user_name, user_avatar, message, type, recipient_id, message_type, voice_url, voice_duration, is_read)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'voice', ?, ?, 0)`,
            [messageId, req.user.familyId, req.user.id, userName, userAvatar, '🎤 Голосовое сообщение', 
             type || 'family', type === 'private' ? recipientId : null, voiceUrl, duration ? parseInt(duration) : null]
        );

        const messages = await query('SELECT * FROM chat_messages WHERE id = ?', [messageId]);
        res.status(201).json(messages[0]);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки голосового сообщения:', error);
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ error: 'Ошибка загрузки голосового сообщения' });
    }
});

// =====================================================
// КОМНАТЫ (ROOMS)
// =====================================================

app.get('/api/rooms/my-rooms', authenticate, async (req, res) => {
    try {
        const rooms = await query(
            `SELECT id, name, background, data, created_at, updated_at
             FROM rooms
             WHERE user_id = ?
             ORDER BY updated_at DESC`,
            [req.user.id]
        );
        
        const formattedRooms = rooms.map(room => {
            let items = [];
            try {
                const data = room.data ? (typeof room.data === 'string' ? JSON.parse(room.data) : room.data) : {};
                items = data.items || [];
            } catch (e) {
                console.error('Ошибка парсинга data:', e);
            }
            return {
                id: room.id,
                name: room.name,
                background: room.background || 'bg_default',
                items: items,
                createdAt: room.created_at,
                updatedAt: room.updated_at
            };
        });
        
        res.json(formattedRooms);
    } catch (error) {
        console.error('Ошибка получения комнат пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/rooms/create', authenticate, async (req, res) => {
    try {
        const { name, background, items } = req.body;
        
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Название комнаты обязательно' });
        }
        
        const roomId = generateUUID();
        const roomData = { items: items || [], background: background || 'bg_default' };
        
        await query(
            `INSERT INTO rooms (id, user_id, family_id, name, data, background, width, height, grid_size)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [roomId, req.user.id, req.user.familyId || null, name.trim(), JSON.stringify(roomData), 
             background || 'bg_default', 20, 15, 64]
        );
        
        const newRoom = await query('SELECT * FROM rooms WHERE id = ?', [roomId]);
        
        res.status(201).json({
            id: newRoom[0].id,
            name: newRoom[0].name,
            background: newRoom[0].background || 'bg_default',
            items: roomData.items,
            createdAt: newRoom[0].created_at
        });
    } catch (error) {
        console.error('Ошибка создания комнаты:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/rooms/:roomId', authenticate, async (req, res) => {
    try {
        const { roomId } = req.params;
        
        const rooms = await query(
            `SELECT id, user_id, family_id, name, data, background, created_at, updated_at FROM rooms WHERE id = ?`,
            [roomId]
        );
        
        if (rooms.length === 0) {
            return res.status(404).json({ error: 'Комната не найдена' });
        }
        
        const room = rooms[0];
        const isOwner = room.user_id === req.user.id;
        const isFamilyMember = room.family_id && room.family_id === req.user.familyId;
        const isParentViewingChild = req.user.role === 'parent' && room.family_id === req.user.familyId && room.user_id !== req.user.id;
        
        if (!isOwner && !isFamilyMember && !isParentViewingChild) {
            return res.status(403).json({ error: 'Нет доступа к этой комнате' });
        }
        
        const readOnly = (req.user.role === 'parent' && room.user_id !== req.user.id) || 
                        (room.user_id !== req.user.id && req.user.role !== 'admin');
        
        let items = [];
        try {
            const data = room.data ? (typeof room.data === 'string' ? JSON.parse(room.data) : room.data) : {};
            items = data.items || [];
        } catch (e) {}
        
        res.json({
            id: room.id,
            name: room.name,
            userId: room.user_id,
            background: room.background || 'bg_default',
            items: items,
            readOnly: readOnly,
            createdAt: room.created_at
        });
    } catch (error) {
        console.error('Ошибка получения комнаты:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/rooms/child-rooms/:childId', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'parent' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Только родители могут просматривать комнаты детей' });
        }
        
        const { childId } = req.params;
        
        const childUsers = await query('SELECT id, family_id FROM users WHERE id = ? AND role = ?', [childId, 'child']);
        if (childUsers.length === 0) return res.status(404).json({ error: 'Ребенок не найден' });
        
        const child = childUsers[0];
        if (child.family_id !== req.user.familyId) return res.status(403).json({ error: 'Ребенок не из вашей семьи' });
        
        const rooms = await query(
            `SELECT id, name, background, data, created_at, updated_at FROM rooms WHERE user_id = ? ORDER BY updated_at DESC`,
            [childId]
        );
        
        const formattedRooms = rooms.map(room => {
            let items = [];
            try {
                const data = room.data ? (typeof room.data === 'string' ? JSON.parse(room.data) : room.data) : {};
                items = data.items || [];
            } catch (e) {}
            return {
                id: room.id,
                name: room.name,
                background: room.background || 'bg_default',
                items: items,
                createdAt: room.created_at,
                readOnly: true
            };
        });
        
        res.json(formattedRooms);
    } catch (error) {
        console.error('Ошибка получения комнат ребенка:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/rooms/:roomId', authenticate, async (req, res) => {
    try {
        const { roomId } = req.params;
        const { name, background, items } = req.body;
        
        console.log('📦 PUT /api/rooms/:roomId — получены предметы:', items?.length || 0, 'шт.');
        
        const rooms = await query('SELECT user_id, family_id FROM rooms WHERE id = ?', [roomId]);
        if (rooms.length === 0) return res.status(404).json({ error: 'Комната не найдена' });
        
        const room = rooms[0];
        const isOwner = room.user_id === req.user.id;
        const isFamilyAdmin = req.user.role === 'parent' && room.family_id === req.user.familyId;
        
        if (!isOwner && !isFamilyAdmin) {
            return res.status(403).json({ error: 'Нет прав на редактирование' });
        }
        
        const roomData = { items: items || [], background: background || 'bg_default' };
        const dataToSave = JSON.stringify(roomData);
        console.log('💾 Сохраняем в БД:', dataToSave.substring(0, 100) + '...');
        
        await query(
            `UPDATE rooms SET name = ?, background = ?, data = ?, updated_at = NOW() WHERE id = ?`,
            [name || 'Моя комната', background || 'bg_default', dataToSave, roomId]
        );
        
        console.log('✅ Комната обновлена в БД');
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка обновления комнаты:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.delete('/api/rooms/:roomId', authenticate, async (req, res) => {
    try {
        const { roomId } = req.params;
        const rooms = await query('SELECT user_id FROM rooms WHERE id = ?', [roomId]);
        if (rooms.length === 0) return res.status(404).json({ error: 'Комната не найдена' });
        if (rooms[0].user_id !== req.user.id) return res.status(403).json({ error: 'Нет прав на удаление' });
        
        await query('DELETE FROM rooms WHERE id = ?', [roomId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка удаления комнаты:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// =====================================================
// ЧЛЕНЫ СЕМЬИ
// =====================================================

app.get('/api/families/:id/members', authenticate, async (req, res) => {
    try {
        const members = await query(
            `SELECT id, name, role, avatar, bonuses, last_login
             FROM users WHERE family_id = ?
             ORDER BY CASE role WHEN 'parent' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, name`,
            [req.params.id]
        );
        res.json(members);
    } catch (error) {
        console.error('Ошибка получения членов семьи:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/users/avatar', authenticate, async (req, res) => {
    try {
        const { imageData } = req.body;
        if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Некорректное изображение' });
        }

        const matches = imageData.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
        if (!matches) return res.status(400).json({ error: 'Поддерживаются png, jpg, webp' });

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
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ КОМНАТ
// =====================================================

async function createRoomForUser({ userId, familyId, name, roomType = 'custom', baseData = null }) {
    const roomId = generateUUID();
    const roomData = baseData && typeof baseData === 'object'
        ? { ...baseData, meta: { ...(baseData.meta || {}), roomType } }
        : { meta: { roomType }, items: [] };

    await query(
        `INSERT INTO rooms (id, user_id, family_id, name, data, background, width, height, grid_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [roomId, userId, familyId, name, JSON.stringify(roomData), 'bg_default', 20, 15, 64]
    );
    return roomId;
}

async function getFamilyCommonRoomData(familyId) {
    try {
        const rooms = await query(`SELECT data FROM rooms WHERE family_id = ? AND name = 'Общая комната семьи' LIMIT 1`, [familyId]);
        if (rooms.length > 0) return JSON.parse(rooms[0].data);
    } catch (error) {
        console.error('Ошибка получения данных общей комнаты:', error);
    }
    return { meta: { roomType: 'family' }, items: [] };
}

async function ensureParentCommonRoom({ userId, familyId }) {
    const existing = await query('SELECT id FROM rooms WHERE family_id = ? AND name = ?', [familyId, 'Общая комната семьи']);
    if (existing.length > 0) return;

    const roomId = generateUUID();
    await query(
        `INSERT INTO rooms (id, user_id, family_id, name, data, background, width, height, grid_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [roomId, null, familyId, 'Общая комната семьи', JSON.stringify({ meta: { roomType: 'family' }, items: [] }), 'bg_default', 20, 15, 64]
    );
}

async function ensurePersonalRoom({ userId, familyId, userName }) {
    const roomName = `Личная комната ${userName}`;
    const existing = await query('SELECT id FROM rooms WHERE user_id = ? AND name = ?', [userId, roomName]);
    if (existing.length > 0) return;

    await createRoomForUser({
        userId, familyId, name: roomName, roomType: 'personal',
        baseData: { meta: { roomType: 'personal' }, items: [] }
    });
}

async function ensureChildFamilyRooms({ userId, familyId, userName }) {
    console.log(`👶 Ребенок ${userName} зарегистрирован. Лишние комнаты НЕ создаются.`);
    
    const existingRoom = await query('SELECT id FROM rooms WHERE user_id = ? AND name = ?', [userId, 'Моя комната']);
    if (existingRoom.length === 0) {
        await createRoomForUser({
            userId, familyId, name: 'Моя комната', roomType: 'personal',
            baseData: { meta: { roomType: 'personal' }, items: [] }
        });
    }
}
// =====================================================
// ВОССТАНОВЛЕНИЕ ПАРОЛЯ
// =====================================================

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email обязателен' });
        }

        const users = await query(
            'SELECT id, name FROM users WHERE email = ?',
            [email.toLowerCase()]
        );
        
        if (users.length === 0) {
            return res.json({ 
                success: true, 
                message: 'Если email зарегистрирован, код отправлен' 
            });
        }

        const user = users[0];
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        resetCodes.set(email.toLowerCase(), {
            userId: user.id,
            code: code,
            expiresAt: Date.now() + 10 * 60 * 1000
        });

        await emailTransporter.sendMail({
            from: `"HomeSpace" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Восстановление пароля HomeSpace',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #4ecca3;">🏠 HomeSpace</h1>
                    <h2>Восстановление пароля</h2>
                    <p>Здравствуйте, ${user.name || 'пользователь'}!</p>
                    <p>Ваш код для восстановления пароля:</p>
                    <div style="font-size: 32px; font-weight: bold; padding: 20px; background: #f0f0f0; text-align: center; border-radius: 10px; letter-spacing: 5px;">
                        ${code}
                    </div>
                    <p>Код действителен в течение <strong>10 минут</strong>.</p>
                    <p>Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.</p>
                    <hr>
                    <small>HomeSpace - семейный органайзер</small>
                </div>
            `,
            text: `HomeSpace: Ваш код для восстановления пароля: ${code}. Код действителен 10 минут.`
        });

        console.log(`✅ Код ${code} отправлен на ${email}`);
        res.json({ success: true, message: 'Код отправлен на email' });

    } catch (error) {
        console.error('Ошибка forgot-password:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        
        if (!email || !code || !newPassword) {
            return res.status(400).json({ error: 'Недостаточно данных' });
        }
        
        if (newPassword.length < 3) {
            return res.status(400).json({ error: 'Пароль должен быть минимум 3 символа' });
        }

        const record = resetCodes.get(email.toLowerCase());
        
        if (!record) {
            return res.status(400).json({ error: 'Код не найден. Запросите новый' });
        }
        
        if (record.expiresAt < Date.now()) {
            resetCodes.delete(email.toLowerCase());
            return res.status(400).json({ error: 'Код просрочен. Запросите новый' });
        }
        
        if (record.code !== code.trim()) {
            return res.status(400).json({ error: 'Неверный код' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        
        await query(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [passwordHash, record.userId]
        );
        
        resetCodes.delete(email.toLowerCase());

        res.json({ success: true, message: 'Пароль успешно изменён' });

    } catch (error) {
        console.error('Ошибка reset-password:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// =====================================================
// БОТ: СОБЫТИЯ
// =====================================================

app.get('/api/bot/events', authenticate, async (req, res) => {
    try {
        const { since } = req.query;
        const familyId = req.user.familyId;
        if (!familyId) return res.json([]);

        const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000);
        
        let tasks = [];
        let wishes = [];
        
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
        } catch (e) {
            console.error('Ошибка загрузки заданий для бота:', e);
        }
        
        try {
            const result = await query(`
                SELECT 'wish_pending' as type, title, price, created_at,
                       (SELECT name FROM users WHERE id = wishes.created_by) as creator_name
                FROM wishes 
                WHERE family_id = ? AND status = 'pending' AND created_at > ?
            `, [familyId, sinceDate]);
            wishes = Array.isArray(result) ? result : [];
        } catch (e) {
            console.error('Ошибка загрузки желаний для бота:', e);
        }

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

// =====================================================
// СТАТИСТИКА ПОЛЬЗОВАТЕЛЯ
// =====================================================

app.get('/api/users/stats', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const [taskStats] = await query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
            FROM tasks WHERE assigned_to = ?
        `, [userId]);
        
        const [wishStats] = await query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'purchased' THEN 1 ELSE 0 END) as purchased
            FROM wishes WHERE created_by = ?
        `, [userId]);
        
        const [bonusStats] = await query(`
            SELECT COALESCE(SUM(amount), 0) as earned
            FROM bonus_history 
            WHERE user_id = ? AND type = 'task_completion'
        `, [userId]);
        
        res.json({
            tasks: {
                total: taskStats?.total || 0,
                completed: taskStats?.completed || 0,
                pending: taskStats?.pending || 0
            },
            wishes: {
                total: wishStats?.total || 0,
                purchased: wishStats?.purchased || 0
            },
            bonuses: {
                earned: bonusStats?.earned || 0,
                current: req.user.bonuses || 0
            }
        });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// =====================================================
// ЗАПУСК СЕРВЕРА
// =====================================================

async function startServer() {
    const dbConnected = await testConnection();
    if (!dbConnected) console.log('⚠️ База данных не подключена');

    const server = http.createServer(app);
    
    const io = new SocketServer(server, {
        cors: {
            origin: ['http://localhost:3000', 'http://localhost:5173'],
            credentials: true
        }
    });

    const BOT_ID = '00000000-0000-0000-0000-000000000001';
    await query(`INSERT IGNORE INTO users (id, email, password_hash, name, avatar, role, family_id, bonuses, created_at) 
                 VALUES (?, 'bot@homespace.local', '', '🤖 Бот-помощник', '🤖', 'bot', NULL, 0, NOW())`, [BOT_ID]);

    // Автозадания: таблица + процессор расписания
    try {
        await ensureTaskSchedulesV2Table();
    } catch (e) {
        console.error('⚠️ Не удалось подготовить task_schedules_v2:', e?.message || e);
    }

async function processDueSchedules() {
    try {
        await ensureTaskSchedulesV2Table();
        // Получаем только те расписания, которые нужно запустить сейчас
        const due = await query(
            `SELECT * FROM task_schedules_v2 
             WHERE schedule_type IS NOT NULL 
               AND active = 1 
               AND next_run_at <= NOW() 
             ORDER BY next_run_at ASC LIMIT 50`
        );
        for (const s of due) {
            // Проверяем, не создано ли уже задание для этого расписания за текущий период
            const [recent] = await query(
                `SELECT COUNT(*) as cnt FROM tasks 
                 WHERE created_by = ? 
                   AND title = ? 
                   AND created_at > DATE_SUB(NOW(), INTERVAL 23 HOUR)`,
                [s.created_by, s.title || 'Автозадание']
            );
            
            if (recent.cnt > 0 && s.schedule_type !== 'once') {
                // Пропускаем, если задание уже создано за последние 23 часа (для daily)
                // Обновляем next_run_at на следующие сутки
                const nextDay = new Date();
                nextDay.setDate(nextDay.getDate() + 1);
                nextDay.setHours(parseTimeOfDay(s.time_of_day)?.hh || 9, parseTimeOfDay(s.time_of_day)?.mm || 0, 0, 0);
                await query(`UPDATE task_schedules_v2 SET next_run_at = ? WHERE id = ?`, [nextDay, s.id]);
                continue;
            }
            
            // Создаем задание...
            const taskId = generateUUID();
            await query(
                `INSERT INTO tasks (id, family_id, created_by, assigned_to, title, description, bonus, item_key, item_instance_id, due_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [taskId, s.family_id || null, s.created_by, s.assigned_to || null, 
                 s.title || 'Автозадание', s.description || '', s.bonus || 10, 
                 s.item_key || null, s.item_instance_id || null, new Date()]
            );
            
            // Обновляем next_run_at в зависимости от типа расписания
            if (s.schedule_type === 'once') {
                await query(`UPDATE task_schedules_v2 SET active = 0, last_run_at = NOW() WHERE id = ?`, [s.id]);
            } else {
                let days = [];
                try { days = s.days_of_week_json ? JSON.parse(s.days_of_week_json) : []; } catch { days = []; }
                const next = computeNextRunAtV2({
                    scheduleType: s.schedule_type,
                    timeOfDay: s.time_of_day,
                    daysOfWeek: days,
                    runAt: s.run_at,
                    timezoneOffsetMin: s.timezone_offset_min
                });
                if (next) {
                    await query(`UPDATE task_schedules_v2 SET last_run_at = NOW(), next_run_at = ? WHERE id = ?`, [next, s.id]);
                } else {
                    await query(`UPDATE task_schedules_v2 SET active = 0, last_run_at = NOW() WHERE id = ?`, [s.id]);
                }
            }
        }
    } catch (e) {
        console.error('⚠️ Ошибка процессинга автозаданий:', e?.message || e);
    }
}

    // Проверяем расписания каждую минуту
    setInterval(processDueSchedules, 60 * 1000);
    // И один раз сразу при старте
    setTimeout(processDueSchedules, 5000);

    io.on('connection', (socket) => {
        console.log('🔌 Новый клиент подключён:', socket.id);

        socket.on('join-family', async (data) => {
            const { familyId, userId, userName, userAvatar, token } = data;
            socket.join(`family:${familyId}`);
            socket.data = { familyId, userId, userName, userAvatar };
            console.log(`👤 ${userName} (${userId}) присоединился к семье ${familyId}`);
        });

        socket.on('send-message', async (data) => {
            const { familyId, message, type, recipientId } = data;
            const { userId, userName, userAvatar } = socket.data;

            if (!userId || !familyId) return;

            const messageId = generateUUID();
            const finalRecipientId = (type === 'private' && recipientId) ? recipientId : null;

            try {
                await query(
                    `INSERT INTO chat_messages (id, family_id, user_id, user_name, user_avatar, message, type, recipient_id, is_read, message_type)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'text')`,
                    [messageId, familyId, userId, userName, userAvatar, message.trim(), type || 'family', finalRecipientId, 0]
                );

                const [newMsg] = await query('SELECT * FROM chat_messages WHERE id = ?', [messageId]);
                io.to(`family:${familyId}`).emit('new-message', newMsg);
            } catch (err) {
                console.error('Ошибка сохранения сообщения через сокет:', err);
            }
        });

        socket.on('voice-message', (data) => {
            io.to(`family:${data.familyId}`).emit('new-message', data.messageData);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Клиент отключён:', socket.id);
        });
    });

    server.listen(PORT, () => {
        console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
        console.log(`📡 WebSocket готов`);
        console.log(`📝 Регистрация: POST /api/auth/register`);
        console.log(`🔑 Вход: POST /api/auth/login`);
        console.log(`✅ Задания: GET/POST /api/tasks`);
        console.log(`✅ Желания: GET/POST /api/wishes`);
        console.log(`✅ Чат: GET/POST /api/chat`);
        console.log(`✅ Комнаты: GET/POST/PUT/DELETE /api/rooms`);
    });
}

startServer();