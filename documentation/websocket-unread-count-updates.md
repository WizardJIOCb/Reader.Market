# WebSocket-based Unread Message Count Updates

## Overview

Реализована система отправки количества непрочитанных сообщений через WebSocket события вместо постоянных HTTP-запросов. Это значительно снижает нагрузку на сервер и улучшает отзывчивость интерфейса.

## Что было реализовано

### 1. Новое WebSocket событие

**Файл:** `client/src/lib/socket.ts`

Добавлено новое событие в интерфейс `SocketEvents`:
```typescript
'unread-count:update': (data: { count: number }) => void;
```

### 2. Серверная функция отправки обновлений

**Файл:** `server/storage.ts`

Добавлена функция `sendUnreadCountUpdate`:
```typescript
async sendUnreadCountUpdate(userId: string, io: any): Promise<void> {
  try {
    const count = await this.getUnreadMessageCount(userId);
    
    // Emit to user's personal room
    const userRoom = `user:${userId}`;
    io.to(userRoom).emit('unread-count:update', { count });
    
    console.log(`[UNREAD COUNT] Sent update to user ${userId}: ${count} unread messages`);
  } catch (error) {
    console.error("Error sending unread count update:", error);
  }
}
```

### 3. Интеграция в ключевые точки системы

#### При получении нового приватного сообщения:
**Файл:** `server/routes.ts` (в обработчике POST /api/messages)

```typescript
// После отправки уведомления
await storage.sendUnreadCountUpdate(recipientId, io);
```

#### При получении нового сообщения в группе:
**Файл:** `server/routes.ts` (в обработчике POST /api/groups/:groupId/channels/:channelId/messages)

```typescript
// Send unread count updates to all group members (except sender)
const groupMembers = await storage.getGroupMembers(groupId);
for (const member of groupMembers) {
  if (member.userId !== userId) {
    await storage.sendUnreadCountUpdate(member.userId, io);
  }
}
```

#### При пометке сообщений как прочитанных:
**Файл:** `server/routes.ts` (в обработчике GET /api/conversations/:conversationId/messages)

```typescript
// Send unread count update to user
const io = (app as any).io;
if (io) {
  await storage.sendUnreadCountUpdate(userId, io);
}
```

### 4. Обновление клиентской логики

#### Navbar компонент:
**Файл:** `client/src/components/Navbar.tsx`

Удалено polling каждые 30 секунд, добавлен обработчик WebSocket события:

```typescript
// Listen for real-time unread count updates via WebSocket
const cleanupUnreadUpdate = onSocketEvent('unread-count:update', (data) => {
  console.log('%c[UNREAD COUNT] Received WebSocket update:', 'color: purple; font-weight: bold', data);
  setUnreadCount(data.count);
});

// Listen for notification events as fallback
const cleanupNotification = onSocketEvent('notification:new', (data) => {
  if (data.type === 'new_message') {
    // Fallback: fetch count from API if WebSocket update wasn't received
    fetchUnreadCount();
  }
});
```

#### MobileMenu компонент:
**Файл:** `client/src/components/MobileMenu.tsx`

Аналогично Navbar - заменено polling на WebSocket обработчики.

## Преимущества реализации

### 1. Снижение нагрузки на сервер
- **Было:** Постоянные HTTP-запросы каждые 30 секунд
- **Стало:** Только при реальных изменениях данных

### 2. Улучшенная отзывчивость
- Мгновенное обновление счетчика при получении новых сообщений
- Отсутствие задержек из-за polling интервалов

### 3. Экономия ресурсов
- Меньше сетевых запросов
- Меньше нагрузка на базу данных
- Более эффективное использование WebSocket соединений

### 4. Надежность
- Сохранен fallback механизм через notification:new события
- Ручное обновление через update-unread-count событие

## Технические детали

### WebSocket комнаты
- Каждый пользователь имеет персональную комнату: `user:{userId}`
- Обновления отправляются только в эту комнату
- Минимальная нагрузка на сеть

### Логирование
- Подробное логирование всех отправляемых обновлений
- Цветные сообщения в консоли для лучшей отладки
- Мониторинг доставки событий

### Безопасность
- Обновления отправляются только авторизованным пользователям
- Проверка прав доступа на уровне WebSocket соединений
- Защита от спама и злоупотреблений

## Тестирование

Для проверки работы системы:

1. Откройте два браузера с разными аккаунтами
2. Отправьте сообщение от одного пользователя другому
3. Убедитесь, что счетчик непрочитанных сообщений мгновенно обновляется
4. Проверьте, что нет polling запросов в Network tab
5. Убедитесь, что при открытии сообщений счетчик обнуляется

## Совместимость

- Полностью обратно совместимо с существующим кодом
- Не требует миграций базы данных
- Работает с текущими версиями всех зависимостей
- Поддерживает все существующие функции мессенджера

## Мониторинг

Для отслеживания работы системы можно смотреть:
- Логи сервера с тегом `[UNREAD COUNT]`
- Консоль браузера с цветными сообщениями
- Network tab для подтверждения отсутствия polling
- WebSocket сообщения в инструментах разработчика