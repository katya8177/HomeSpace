# Инструкция по добавлению функционала удаления и редактирования сообщений

## Что было добавлено

### 1. Функционал редактирования сообщений

- Только автор сообщения может его редактировать
- После редактирования к сообщению добавляется отметка "(ред.)"
- Хранится оригинальное сообщение

### 2. Функционал удаления сообщений

Два типа удаления:

- **Удалить у себя** - сообщение скрывается только для текущего пользователя
- **Удалить для всех** - сообщение удаляется для всех членов семьи

### 3. Правила доступа

- **Обычный пользователь (user/child)** - может удалять/редактировать ТОЛЬКО свои сообщения
- **Родитель (parent/admin)** - может удалять любые сообщения семьи

## Шаги внедрения

### Шаг 1: Применить миграцию БД

Выполните SQL код из файла `server/migrations/001_add_message_edit_delete.sql`:

```sql
ALTER TABLE chat_messages ADD COLUMN is_edited BOOLEAN DEFAULT FALSE AFTER message;
ALTER TABLE chat_messages ADD COLUMN edited_at DATETIME DEFAULT NULL AFTER is_edited;
ALTER TABLE chat_messages ADD COLUMN original_message TEXT DEFAULT NULL AFTER edited_at;
ALTER TABLE chat_messages ADD COLUMN deleted_by_user BOOLEAN DEFAULT FALSE AFTER original_message;
ALTER TABLE chat_messages ADD COLUMN deleted_for_all BOOLEAN DEFAULT FALSE AFTER deleted_by_user;
ALTER TABLE chat_messages ADD COLUMN deleted_at DATETIME DEFAULT NULL AFTER deleted_for_all;

ALTER TABLE chat_messages ADD INDEX idx_deleted_for_all (deleted_for_all);
ALTER TABLE chat_messages ADD INDEX idx_deleted_by_user (deleted_by_user);
ALTER TABLE chat_messages ADD INDEX idx_family_not_deleted (family_id, deleted_for_all);
```

### Шаг 2: Перезагрузить сервер и приложение

- Перезагрузите Node.js сервер
- Перезагрузите браузер (Ctrl+F5 или Cmd+Shift+R)

## Функции на сервере (server/index.js)

### PATCH /api/chat/:messageId

Редактирует сообщение (только автор может редактировать свои)

```
Body: { message: "новый текст" }
```

### DELETE /api/chat/:messageId

Удаляет сообщение

```
Body: { deleteForAll: false } // false = удалить у себя, true = удалить для всех
```

### GET /api/chat

Обновлен для фильтрации:

- Не возвращает сообщения, удаленные для всех
- Возвращает новые поля: is_edited, edited_at, original_message, deleted_by_user, deleted_for_all
- Скрывает сообщения, удаленные текущим пользователем

## Функции на клиенте (api.js)

### editMessage(messageId, newMessage)

Редактирует сообщение

### deleteMessage(messageId, deleteForAll = false)

Удаляет сообщение (у себя или для всех)

## Интерфейс (ChatScene.js)

### Кнопка меню сообщения

При наведении на каждое сообщение (для своих или если админ) появляется кнопка "⋮" (три точки)

### Меню действий

После нажатия на кнопку "⋮" открывается меню с опциями:

- ✎ Редактировать (только если это ваше текстовое сообщение)
- 🗑 Удалить у себя
- 🗑 Удалить для всех (только если автор или админ)

### Отметка редактирования

После редактирования сообщения к его тексту добавляется " (ред.)"

## Файлы, которые были изменены

1. **server/index.js**
   - Обновлен GET /api/chat для фильтрации удаленных сообщений
   - Добавлен PATCH /api/chat/:messageId для редактирования
   - Добавлен DELETE /api/chat/:messageId для удаления

2. **docs/src/services/api.js**
   - Добавлен метод editMessage()
   - Добавлен метод deleteMessage()

3. **docs/src/scenes/ChatScene.js**
   - Обновлена функция displayMessages() для отображения "(ред.)" и кнопок меню
   - Добавлена функция showMessageMenu() для отображения меню действий
   - Добавлены функции editMessage(), deleteMessageForMe(), deleteMessageForAll()

4. **server/migrations/001_add_message_edit_delete.sql**
   - SQL миграция для добавления необходимых полей в БД
