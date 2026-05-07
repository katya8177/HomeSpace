-- Миграция: добавление функционала удаления и редактирования сообщений

-- Добавляем поля для редактирования
ALTER TABLE chat_messages ADD COLUMN is_edited BOOLEAN DEFAULT FALSE AFTER message;
ALTER TABLE chat_messages ADD COLUMN edited_at DATETIME DEFAULT NULL AFTER is_edited;
ALTER TABLE chat_messages ADD COLUMN original_message TEXT DEFAULT NULL AFTER edited_at;

-- Добавляем поля для отслеживания логического удаления
ALTER TABLE chat_messages ADD COLUMN deleted_by_user BOOLEAN DEFAULT FALSE AFTER original_message;
ALTER TABLE chat_messages ADD COLUMN deleted_for_all BOOLEAN DEFAULT FALSE AFTER deleted_by_user;
ALTER TABLE chat_messages ADD COLUMN deleted_at DATETIME DEFAULT NULL AFTER deleted_for_all;

-- Индексы для быстрого поиска
ALTER TABLE chat_messages ADD INDEX idx_deleted_for_all (deleted_for_all);
ALTER TABLE chat_messages ADD INDEX idx_deleted_by_user (deleted_by_user);
ALTER TABLE chat_messages ADD INDEX idx_family_not_deleted (family_id, deleted_for_all);
