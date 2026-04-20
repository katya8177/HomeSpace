// server/bot-service.js
// Семейный бот-помощник HomeSpace (ES Module версия)

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// ========== КОНФИГУРАЦИЯ ==========
const config = {
    db: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'homespace family organizer'
    },
    botUserId: '00000000-0000-0000-0000-000000000001',
    botName: '🤖 Бот-помощник',
    botAvatar: '🤖',
    checkInterval: 5000 // 5 секунд
};

let db = null;
let lastCheckTime = new Date();

// ========== ПОДКЛЮЧЕНИЕ К БД ==========
async function connectDB() {
    try {
        db = await mysql.createConnection(config.db);
        console.log('✅ [БОТ] Подключен к базе данных');
    } catch (error) {
        console.error('❌ [БОТ] Ошибка подключения к БД:', error.message);
        process.exit(1);
    }
}

// ========== СОЗДАНИЕ БОТА В СИСТЕМЕ ==========
async function ensureBotExists() {
    try {
        const [existing] = await db.query('SELECT id FROM users WHERE id = ?', [config.botUserId]);
        
        if (existing.length === 0) {
            await db.query(`
                INSERT INTO users (id, email, password_hash, name, avatar, role, family_id, bonuses, created_at)
                VALUES (?, 'bot@homespace.local', '', ?, ?, 'bot', NULL, 0, NOW())
            `, [config.botUserId, config.botName, config.botAvatar]);
            console.log('✅ [БОТ] Виртуальный пользователь создан');
        } else {
            console.log('✅ [БОТ] Бот уже существует');
        }
    } catch (error) {
        console.error('❌ [БОТ] Ошибка создания бота:', error.message);
    }
}

// ========== ПОЛУЧЕНИЕ НОВЫХ СОБЫТИЙ ==========
async function getNewEvents() {
    const events = [];
    
    try {
        // Новые задания
        const [newTasks] = await db.query(`
            SELECT t.id, t.title, t.bonus, t.family_id, t.assigned_to, u.name as assigned_name, c.name as created_name
            FROM tasks t
            JOIN users u ON t.assigned_to = u.id
            JOIN users c ON t.created_by = c.id
            WHERE t.created_at > ? AND t.assigned_to IS NOT NULL AND t.created_by != t.assigned_to
        `, [lastCheckTime]);
        
        for (const task of newTasks) {
            events.push({
                type: 'task_assigned',
                familyId: task.family_id,
                userId: task.assigned_to,
                message: `📋 **${task.created_name}** создал(а) для тебя задание: **"${task.title}"**\n💰 Награда: ${task.bonus} бонусов`
            });
        }
        
        // Выполненные задания
        const [completedTasks] = await db.query(`
            SELECT t.id, t.title, t.bonus, t.family_id, t.assigned_to, u.name as assigned_name, c.name as completed_name
            FROM tasks t
            JOIN users u ON t.assigned_to = u.id
            JOIN users c ON t.completed_by = c.id
            WHERE t.completed_at > ? AND t.status = 'completed'
        `, [lastCheckTime]);
        
        for (const task of completedTasks) {
            events.push({
                type: 'task_completed',
                familyId: task.family_id,
                userId: task.assigned_to,
                message: `✅ **${task.completed_name}** выполнил(а) **"${task.title}"** и получил(а) **${task.bonus}** бонусов! 🎉`
            });
        }
        
        // Желания на одобрение
        const [pendingWishes] = await db.query(`
            SELECT w.id, w.title, w.price, w.family_id, w.created_by, u.name as created_name
            FROM wishes w
            JOIN users u ON w.created_by = u.id
            WHERE w.created_at > ? AND w.status = 'pending'
        `, [lastCheckTime]);
        
        for (const wish of pendingWishes) {
            const [parents] = await db.query(`SELECT id FROM users WHERE family_id = ? AND role = 'parent'`, [wish.family_id]);
            for (const parent of parents) {
                events.push({
                    type: 'wish_pending',
                    familyId: wish.family_id,
                    userId: parent.id,
                    message: `🎁 **${wish.created_name}** хочет: **"${wish.title}"**\n💰 Цена: ${wish.price} бонусов\n⏳ Требуется одобрение`
                });
            }
        }
        
        // Одобренные желания
        const [approvedWishes] = await db.query(`
            SELECT w.id, w.title, w.approved_price, w.family_id, w.created_by, u.name as created_name, a.name as approved_name
            FROM wishes w
            JOIN users u ON w.created_by = u.id
            JOIN users a ON w.approved_by = a.id
            WHERE w.approved_at > ? AND w.status = 'approved'
        `, [lastCheckTime]);
        
        for (const wish of approvedWishes) {
            events.push({
                type: 'wish_approved',
                familyId: wish.family_id,
                userId: wish.created_by,
                message: `✅ **${wish.approved_name}** одобрил(а) твоё желание **"${wish.title}"**!\n💰 Цена: ${wish.approved_price} бонусов\n🛒 Теперь можно купить!`
            });
        }
        
        // Новые члены семьи
        const [newMembers] = await db.query(`
            SELECT u.id, u.name, u.family_id FROM users u WHERE u.created_at > ? AND u.family_id IS NOT NULL
        `, [lastCheckTime]);
        
        for (const member of newMembers) {
            const [familyMembers] = await db.query(`SELECT id FROM users WHERE family_id = ? AND id != ?`, [member.family_id, member.id]);
            for (const fm of familyMembers) {
                events.push({
                    type: 'family_join',
                    familyId: member.family_id,
                    userId: fm.id,
                    message: `👋 **${member.name}** присоединился(ась) к семье! Добро пожаловать! 🏠`
                });
            }
        }
        
    } catch (error) {
        console.error('❌ [БОТ] Ошибка получения событий:', error.message);
    }
    
    return events;
}

// ========== ОТПРАВКА СООБЩЕНИЯ ==========
async function sendBotMessage(event) {
    try {
        const messageId = uuidv4();
        
        // Проверяем, есть ли бот в users (на случай если семья не указана)
        await db.query(`
            INSERT INTO chat_messages (id, family_id, user_id, user_name, user_avatar, message, type, message_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'family', 'text', NOW())
        `, [messageId, event.familyId, config.botUserId, config.botName, config.botAvatar, event.message]);
        
        console.log(`📨 [БОТ] Сообщение в семью ${event.familyId}: ${event.message.substring(0, 50)}...`);
        
    } catch (error) {
        console.error('❌ [БОТ] Ошибка отправки сообщения:', error.message);
    }
}

// ========== ОСНОВНОЙ ЦИКЛ ==========
async function checkAndProcessEvents() {
    const events = await getNewEvents();
    
    if (events.length > 0) {
        console.log(`📬 [БОТ] Найдено ${events.length} событий`);
        for (const event of events) {
            await sendBotMessage(event);
        }
    }
    
    lastCheckTime = new Date();
}
// ========== ЗАГРУЗКА ГОЛОСОВОГО СООБЩЕНИЯ ==========
router.post('/voice', authenticateToken, voiceUpload.single('audio'), async (req, res) => {
    try {
        const userId = req.user.id;
        const familyId = req.user.familyId;
        const { type = 'family', recipientId, duration } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'Аудиофайл не загружен' });
        }
        
        const [user] = await query('SELECT name, avatar FROM users WHERE id = ?', [userId]);
        
        const messageId = uuidv4();
        const voiceUrl = `/uploads/voice/${req.file.filename}`;
        
        await query(`
            INSERT INTO chat_messages 
            (id, family_id, user_id, user_name, user_avatar, message, type, recipient_id, message_type, voice_url, voice_duration, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'voice', ?, ?, NOW())
        `, [
            messageId, familyId, userId, user.name, user.avatar || '👤',
            '🎤 Голосовое сообщение', type, type === 'private' ? recipientId : null,
            voiceUrl, duration ? parseInt(duration) : null
        ]);
        
        const [newMessage] = await query('SELECT * FROM chat_messages WHERE id = ?', [messageId]);
        res.status(201).json(newMessage);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки голосового:', error);
        if (req.file) fs.unlink(req.file.path, () => {});
        res.status(500).json({ error: 'Ошибка загрузки' });
    }
});
// ========== ЗАПУСК ==========
async function startBot() {
    console.log('==========================================');
    console.log('🤖 Семейный бот-помощник HomeSpace');
    console.log('==========================================');
    
    await connectDB();
    await ensureBotExists();
    
    await checkAndProcessEvents();
    setInterval(checkAndProcessEvents, config.checkInterval);
    
    console.log(`🔄 Бот работает, интервал: ${config.checkInterval / 1000} сек`);
}

process.on('SIGINT', async () => {
    console.log('\n🛑 [БОТ] Остановка...');
    if (db) await db.end();
    process.exit(0);
});

startBot().catch(error => {
    console.error('❌ [БОТ] Критическая ошибка:', error);
    process.exit(1);
});