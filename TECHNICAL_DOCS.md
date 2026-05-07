# Техническая документация: Редактирование и удаление сообщений

## Архитектура

### Уровни удаления

1. **Логическое удаление** (`deleted_by_user`)
   - Сообщение остается в БД
   - Скрыто только для текущего пользователя
   - Другие пользователи видят сообщение

2. **Полное удаление** (`deleted_for_all`)
   - Сообщение помечено как удаленное для всех
   - Не отправляется никому в GET /api/chat
   - Остается в БД для архива/аудита

## Изменения базы данных

### Новые колонки в таблице `chat_messages`

```sql
is_edited BOOLEAN DEFAULT FALSE          -- Было ли редактировано
edited_at DATETIME DEFAULT NULL           -- Дата последнего редактирования
original_message TEXT DEFAULT NULL        -- Оригинальный текст (до редактирования)
deleted_by_user BOOLEAN DEFAULT FALSE     -- Удалено ли текущим пользователем
deleted_for_all BOOLEAN DEFAULT FALSE     -- Удалено ли для всех в семье
deleted_at DATETIME DEFAULT NULL          -- Дата удаления
```

### Индексы

```sql
idx_deleted_for_all          -- Быстрый поиск удаленных сообщений
idx_deleted_by_user          -- Быстрый поиск логически удаленных
idx_family_not_deleted       -- Оптимизация запроса GET /api/chat
```

## API эндпоинты

### PATCH /api/chat/:messageId

**Редактирование сообщения**

```
Требования:
- Аутентификация: ✅ Нужна
- Автор может редактировать: Только свои сообщения
- Родитель может редактировать: Только свои сообщения

Тело запроса:
{
  "message": "новый текст сообщения"
}

Ответ (201):
{
  "id": "uuid",
  "message": "новый текст",
  "is_edited": true,
  "edited_at": "2024-05-05T12:30:45Z",
  "original_message": "старый текст",
  ...
}

Ошибки:
- 400: Пустое сообщение
- 403: Не автор сообщения
- 404: Сообщение не найдено
- 500: Ошибка сервера
```

### DELETE /api/chat/:messageId

**Удаление сообщения**

```
Требования:
- Аутентификация: ✅ Нужна
- Удаление для себя: Все могут удалять
- Удаление для всех: Только автор или родитель/админ

Тело запроса:
{
  "deleteForAll": false  // false = у себя, true = для всех
}

Ответ (200):
{
  "success": true,
  "message": "Сообщение удалено"
}

Ошибки:
- 403: Нет прав на удаление для всех
- 404: Сообщение не найдено
- 500: Ошибка сервера
```

### GET /api/chat (обновлено)

**Получение сообщений**

Теперь возвращает дополнительные поля:

- `is_edited`: boolean - было ли редактировано
- `edited_at`: datetime - когда редактировалось
- `original_message`: string - оригинальный текст
- `deleted_by_user`: boolean - удалено ли для текущего пользователя
- `deleted_for_all`: boolean - удалено ли для всех

Логика фильтрации:

```javascript
// Не отправляем сообщения, удаленные для всех
WHERE deleted_for_all = FALSE

// На клиенте фильтруем сообщения, удаленные текущим пользователем
const filteredMessages = messages.filter(msg => {
  if (msg.deleted_by_user && msg.user_id === currentUserId) {
    return false; // Скрываем
  }
  return true;
});
```

## Проверки безопасности

### Редактирование

```javascript
// Только автор может редактировать
if (msg.user_id !== req.user.id) {
  throw Error("403: Не автор");
}

// Не более 10000 символов
if (newMessage.length > 10000) {
  throw Error("400: Сообщение слишком длинное");
}
```

### Удаление

```javascript
const isAuthor = msg.user_id === req.user.id;
const isParent = req.user.role === "parent" || req.user.role === "admin";

// Удаление для себя: может любой
if (!deleteForAll) {
  await query("UPDATE chat_messages SET deleted_by_user = TRUE ...");
}

// Удаление для всех: только автор или родитель
if (deleteForAll && !isAuthor && !isParent) {
  throw Error("403: Нет прав");
}
```

## Клиентская логика

### API методы (docs/src/services/api.js)

```javascript
async editMessage(messageId, newMessage) {
  const response = await fetch(`/api/chat/${messageId}`, {
    method: 'PATCH',
    headers: this.getHeaders(),
    body: JSON.stringify({ message: newMessage })
  });
  return this.handleResponse(response);
}

async deleteMessage(messageId, deleteForAll = false) {
  const response = await fetch(`/api/chat/${messageId}`, {
    method: 'DELETE',
    headers: this.getHeaders(),
    body: JSON.stringify({ deleteForAll })
  });
  return this.handleResponse(response);
}
```

### UI компоненты (docs/src/scenes/ChatScene.js)

1. **Кнопка меню** ("⋮")
   - Отображается при наведении на сообщение
   - Видна только для автора или админа

2. **Меню действий**
   - "✎ Редактировать" - только если текстовое сообщение
   - "🗑 Удалить у себя" - для всех
   - "🗑 Удалить для всех" - для автора/админа (серое для остальных)

3. **Отметка редактирования**
   - Добавляется к тексту: " (ред.)"
   - Видна у всех пользователей

## Обработка ошибок

### На сервере

```javascript
try {
  // Валидация
  if (!message.trim()) throw new Error('Пустое сообщение');

  // Проверка прав
  if (!canModify) throw new Error('403: Нет прав');

  // Обновление БД
  await query(...);

} catch (error) {
  console.error('Ошибка:', error);
  res.status(error.status || 500).json({ error: error.message });
}
```

### На клиенте

```javascript
try {
  await api.editMessage(id, text);
  this.loadMessages(); // Перезагрузить
  this.showNotification("Успешно", "#4ecca3");
} catch (error) {
  this.showNotification("Ошибка: " + error, "#e94560");
}
```

## Тестирование

### Сценарии для тестирования

1. ✅ Редактирование своего сообщения
   - Текст обновляется
   - Добавляется "(ред.)"
   - Видно всем

2. ✅ Попытка редактирования чужого сообщения
   - Ошибка 403

3. ✅ Удаление для себя
   - Сообщение исчезает в моем чате
   - Видно в чатах других

4. ✅ Удаление для всех (автор)
   - Сообщение исчезает у всех

5. ✅ Удаление для всех (родитель чужого)
   - Сообщение исчезает у всех

6. ✅ Попытка удаления для всех (обычный пользователь)
   - Кнопка серая (неактивная)

## Производительность

### Оптимизации

1. **Индексы**
   - `idx_deleted_for_all` - быстрый фильтр удаленных
   - `idx_family_not_deleted` - оптимизация основного запроса

2. **Кэширование**
   - Сообщения загружаются полностью в памяти клиента
   - На сервере нет кэширования (простой запрос)

3. **Пагинация**
   - Сохранена существующая пагинация (LIMIT)
   - Удаленные сообщения не учитываются в LIMIT

### Сложность

- **GET /api/chat**: O(n) фильтр на клиенте
- **PATCH /api/chat/:id**: O(1)
- **DELETE /api/chat/:id**: O(1)

## Миграция

Выполнить SQL файл:

```bash
mysql homespace_family_organizer < server/migrations/001_add_message_edit_delete.sql
```

Откатить миграцию:

```sql
ALTER TABLE chat_messages
  DROP COLUMN is_edited,
  DROP COLUMN edited_at,
  DROP COLUMN original_message,
  DROP COLUMN deleted_by_user,
  DROP COLUMN deleted_for_all,
  DROP COLUMN deleted_at,
  DROP INDEX idx_deleted_for_all,
  DROP INDEX idx_deleted_by_user,
  DROP INDEX idx_family_not_deleted;
```
