# Backend MVP ONLY (Phase 1) — ТЗ для Qoder

Цель: обеспечить фронтенду минимальный backend для чтения + аннотаций + ИИ. Без PDF, без стриминга, без спойлеров.

Стек:
- Node.js + Express + TypeScript
- PostgreSQL + Drizzle ORM
- AI: Ollama

Форматы:
- EPUB (чтение на фронте через epub.js; backend должен отдавать manifest/TOC/главы при необходимости)
- DOC/DOCX/FB2/TXT — backend конвертирует в normalized HTML и отдаёт главы

---

## 1) MVP Scope (что делаем)

### 1.1 Reader Content API
- `GET /api/reader/books/:bookId/manifest`
- `GET /api/reader/books/:bookId/chapters/:chapterId` (для HTML-книг)

### 1.2 Progress API
- `GET /api/reader/books/:bookId/progress`
- `POST /api/reader/books/:bookId/progress`

### 1.3 Annotations API
- `GET /api/reader/books/:bookId/annotations`
- `POST /api/reader/books/:bookId/annotations`
- `DELETE /api/reader/books/:bookId/annotations/:id`

### 1.4 AI API (без стриминга)
- `POST /api/ai/run`

Фичи AI:
- `summarizeChapter`
- `explainSelection`
- `summarizeAround` (контекст вокруг Location)

Кешировать минимум `summarizeChapter`.

---

## 2) Ключевая архитектура (ОБЯЗАТЕЛЬНО)

### 2.1 Единый Location/LocationRange
Backend должен принимать/хранить Location как JSON.

Типы:
- EPUB: `{ type: "epub-cfi", value: string }`
- HTML: `{ type: "dom-point", value: { elementId, selector?, charOffset? } }`

LocationRange:
- `{ start: Location, end: Location }`

Аннотации и прогресс всегда привязываются к Location.

---

## 3) Хранение файлов и derived артефактов

Книга уже загружается (в проекте есть upload flow). Нужно расширить pipeline для не-EPUB.

### 3.1 Derived files (для doc/docx/fb2/txt)
Генерировать:

```
/uploads/<userId>/<bookId>/
  ├─ original.ext
  └─ derived/
      ├─ normalized.html
      ├─ chapters.json
      ├─ toc.json
      └─ text_map.json
```

**Normalized HTML требования:**
- главы: `<section data-chapter-id="c1" id="ch_c1">`
- параграфы: `<p id="p_c1_000123" data-p-index="123">`
- id должны быть стабильны

**chapters.json**:
- массив `{ chapterId, title?, order, startElementId }`

**toc.json**:
- плоский список или дерево (MVP можно плоский)

**text_map.json**:
- `chapterId -> blocks[]` где block содержит `{ blockId, elementId, text, order }`

Цель text_map: быстро брать текст главы/контекст для ИИ.

---

## 4) DB (Postgres + Drizzle)

### 4.1 reading_progress
- `id`
- `userId`
- `bookId`
- `position` JSONB (ReadingPosition: { location, chapterProgress?, bookProgress?, chapterId? })
- `updatedAt`

Уникальный ключ: `(userId, bookId)`.

### 4.2 annotations (новая таблица)
- `id` (uuid)
- `userId`
- `bookId`
- `type` enum: bookmark | highlight | note
- `location` JSONB nullable (для bookmark)
- `range` JSONB nullable (для highlight/note)
- `quote` text nullable
- `payload` JSONB (label/note/color/tags)
- `createdAt`, `updatedAt`

Индекс: `(userId, bookId)`.

### 4.3 ai_cache
- `id`
- `userId`
- `bookId`
- `feature` (text)
- `key` (text, unique per user/book/feature)
- `responseText` (text)
- `meta` JSONB nullable
- `createdAt`, `updatedAt`

Минимум: кешировать summarizeChapter.

---

## 5) API спецификация (MVP)

### 5.1 Авторизация (обязательно)
Все endpoints должны проверять, что:
- пользователь аутентифицирован
- bookId принадлежит пользователю

Если нет доступа: 403.

---

### 5.2 `GET /api/reader/books/:bookId/manifest`
Возвращает JSON:
```json
{
  "bookId": "...",
  "format": "epub|docx|fb2|txt|html",
  "engine": "epubjs|html",
  "capabilities": {
    "canSelectText": true,
    "canHighlight": true,
    "canGetToc": true,
    "canExtractChapterText": true
  },
  "toc": [{"id":"c1","label":"Chapter 1","location":{...}}],
  "chapters": [{"chapterId":"c1","title":"Chapter 1","startLocation":{...}}]
}
```

Для EPUB:
- chapters/toc можно вернуть упрощённо (если извлекаете на backend), либо вернуть `toc:null` и фронт берёт из epub.js (допустимо MVP).

Для HTML-книг:
- toc/chapters обязательны.

---

### 5.3 `GET /api/reader/books/:bookId/chapters/:chapterId`
Только для HTML-книг.

Ответ:
```json
{
  "chapterId": "c1",
  "title": "...",
  "html": "<section ...>...</section>"
}
```

Требования:
- HTML должен быть **sanitized** (никаких script/onclick/iframe).

---

### 5.4 Progress

#### `GET /api/reader/books/:bookId/progress`
Ответ:
```json
{ "position": { "location": {"type":"...","value":...}, "chapterId":"c1", "bookProgress":0.37 } }
```

#### `POST /api/reader/books/:bookId/progress`
Body:
```json
{ "position": { ... } }
```
Сохраняет upsert.

---

### 5.5 Annotations

#### `GET /api/reader/books/:bookId/annotations`
Ответ: массив annotations.

#### `POST /api/reader/books/:bookId/annotations`
Body:
```json
{
  "type": "bookmark|highlight|note",
  "location": { ... },
  "range": { ... },
  "quote": "...",
  "payload": { "label":"...", "note":"...", "color":"..." }
}
```
Возвращает созданный объект.

#### `DELETE /api/reader/books/:bookId/annotations/:id`
Удаляет.

---

### 5.6 AI

#### `POST /api/ai/run`
Body (минимум):
```json
{
  "bookId": "...",
  "feature": "summarizeChapter|explainSelection|summarizeAround",
  "chapterId": "c1",
  "selection": { "text": "...", "range": {"start":...,"end":...} },
  "location": { ... },
  "window": { "approxChars": 2000, "direction": "both" }
}
```

Ответ:
```json
{ "text": "...", "meta": { "cached": true, "model": "..." } }
```

**Требования к AI-логике MVP:**
- summarizeChapter: берём текст главы целиком (ограничиваем размер), кешируем
- explainSelection: используем selection.text + небольшой контекст вокруг selection
- summarizeAround: берём текст вокруг location из text_map (±N блоков)

Ограничения:
- лимит на входной текст (например 20–40k символов) — лишнее обрезать
- таймаут на Ollama запрос
- ошибки возвращать понятным JSON

---

## 6) Извлечение текста для AI (MVP)

### Для HTML-книг
Источник истины: `text_map.json`.

Функции:
- `getChapterText(bookId, chapterId)`
- `getTextAroundDomPoint(bookId, domPoint, window)`
  - найти block по elementId
  - взять N блоков до/после

### Для EPUB
MVP вариант:
- summarizeChapter/explainSelection можно делать на фронте, но по требованиям лучше через backend.
- В MVP допускается:
  - summarizeChapter: фронт отправляет chapterText в body (временное решение)
  - explainSelection: фронт отправляет selection.text + context

Если делаете серверный разбор EPUB — хорошо, но не обязательно для MVP.

---

## 7) Security & Quality

- Санитизация HTML для выдачи на фронт.
- Проверка прав доступа к bookId.
- Rate limit на AI endpoint (хотя бы простой per-user).
- Логи: время Ollama запроса, cache hit/miss.

---

## 8) Phase 1 Acceptance Criteria (Backend)

1) `manifest` отдаётся и позволяет фронту открыть книгу.
2) `progress` сохраняется и восстанавливается.
3) `annotations` CRUD работает и хранит Location/Range.
4) `POST /api/ai/run`:
   - summarizeChapter работает и кешируется
   - explainSelection работает
   - summarizeAround работает
5) Невозможно получить данные по чужой книге.

---

## 9) Deliverables

- Реализация маршрутов Express + сервисов
- Drizzle migrations для `reading_progress`, `annotations`, `ai_cache`
- Pipeline генерации derived (normalized.html, chapters.json, toc.json, text_map.json) для doc/docx/fb2/txt
- Документация: формат derived файлов и пример ответов API
