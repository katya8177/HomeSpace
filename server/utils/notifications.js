// server/utils/notifications.js
// Функции для создания уведомлений
const { query } = require('./database');
const { v4: uuidv4 } = require('uuid');

async function createNotification({
    userId,
    familyId = null,
    type,
    title,
    message,
    data = {}
}) {
    try {
        const id = uuidv4();
        
        await query(`
            INSERT INTO notifications (id, user_id, family_id, type, title, message, data, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())
        `, [id, userId, familyId, type, title, message, JSON.stringify(data)]);
        
        return id;
    } catch (error) {
        console.error('Ошибка создания уведомления:', error);
        return null;
    }
}

async function notifyTaskAssigned(task, assignedToUser) {
    return createNotification({
        userId: assignedToUser.id,
        familyId: task.family_id,
        type: 'task_assigned',
        title: 'Новое задание',
        message: `Вам назначено: ${task.title}`,
        data: { taskId: task.id, bonus: task.bonus }
    });
}

async function notifyWishApproved(wish, user) {
    return createNotification({
        userId: user.id,
        familyId: wish.family_id,
        type: 'wish_approved',
        title: '🎉 Желание одобрено',
        message: `"${wish.title}" одобрено!`,
        data: { wishId: wish.id }
    });
}

async function notifyWishPending(wish, parents) {
    for (const parent of parents) {
        await createNotification({
            userId: parent.id,
            familyId: wish.family_id,
            type: 'wish_approved',
            title: 'Желание на одобрение',
            message: `${wish.created_by_name} хочет: ${wish.title}`,
            data: { wishId: wish.id, price: wish.price }
        });
    }
}

async function notifyNewMessage(message, recipientId) {
    return createNotification({
        userId: recipientId,
        familyId: message.family_id,
        type: 'system',
        title: 'Новое сообщение',
        message: `${message.user_name}: ${message.message.substring(0, 50)}...`,
        data: { senderId: message.user_id, senderName: message.user_name }
    });
}

module.exports = {
    createNotification,
    notifyTaskAssigned,
    notifyWishApproved,
    notifyWishPending,
    notifyNewMessage
};