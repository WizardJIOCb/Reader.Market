# Полное ТЗ для Qoder: Reader Module (Frontend + Backend) + Routes + Drizzle Schema/Migrations

Документ объединяет **полный объём работ** для Phase 1 (MVP) + подготовку к Phase 2.

Стек проекта:
- Frontend: React 19 + TypeScript, Wouter, TanStack Query, Tailwind, Radix UI
- Backend: Node.js + Express + TypeScript
- DB: PostgreSQL + Drizzle ORM
- AI: Ollama

Форматы:
- MVP: EPUB + (DOC/DOCX/FB2/TXT → normalized HTML)
- PDF: опционально после MVP (read-only)

Ключевые требования:
- Стабильные **якоря позиции** (Location/LocationRange)
- Аннотации: Bookmark/Highlight/Note
- ИИ: summarizeChapter / explainSelection / helpAround
- Сохранение прогресса

---

## 0) Термины и модели данных (общие)

### 0.1 Location / Range (обязательно)
**Location** — единый идентификатор позиции:
- EPUB: `{ type: "epub-cfi", value: string }`
- HTML: `{ type: "dom-point", value: { elementId: string, selector?: string, charOffset?: number } }`
- PDF (позже): `{ type: "pdf-fragment", value: { page: number, rect?: {...}, textAnchor?: {...} } }`

**LocationRange** — диапазон:
```json
{ "start": {"type":"...","value":...}, "end": {"type":"...","value":...} }
```

### 0.2 ReadingPosition
```json
{
  "location": { ... },
  "chapterId": "c1",
  "chapterProgress": 0.21,
  "bookProgress": 0.37
}
```

### 0.3 Annotations
Типы:
- bookmark: привязан к `location`
- highlight: привязан к `range` (+ quote)
- note: привязан к `range` (+ quote + note)

---

## 1) Backend — полная спецификация

### 1.1 Роуты Express (группы)

#### 1) Reader / Content
- `GET    /api/reader/books/:bookId/manifest`
- `GET    /api/reader/books/:bookId/chapters/:chapterId` (только для HTML-книг)

#### 2) Progress
- `GET    /api/reader/books/:bookId/progress`
- `POST   /api/reader/books/:bookId/progress`

#### 3) Annotations
- `GET    /api/reader/books/:bookId/annotations`
- `POST   /api/reader/books/:bookId/annotations`
- `PATCH  /api/reader/books/:bookId/annotations/:id`
- `DELETE /api/reader/books/:bookId/annotations/:id`

#### 4) AI
- `POST   /api/ai/run` (без стриминга в MVP)
- (Phase 2) `POST /api/ai/stream` или `GET /api/ai/stream` (SSE)

---

### 1.2 Авторизация и доступ
Каждый запрос обязан:
1) Проверить auth user
2) Проверить, что `bookId` принадлежит user
3) Иначе 403

---

### 1.3 Manifest contract (backend → frontend)
`GET /api/reader/books/:bookId/manifest`

Ответ:
```json
{
  "bookId": "...",
  "format": "epub|doc|docx|fb2|txt|html",
  "engine": "epubjs|html",
  "title": "...",
  "author": "...",
  "capabilities": {
    "canPaginate": true,
    "canScroll": true,
    "canSelectText": true,
    "canHighlight": true,
    "canSearch": false,
    "canExtractChapterText": true,
    "canGetTextAroundLocation": true,
    "canGoToLocation": true,
    "canGetToc": true
  },
  "toc": [
    {"id":"c1","label":"Chapter 1","location": {"type":"dom-point","value":{"elementId":"ch_c1"}}}
  ],
  "chapters": [
    {"chapterId":"c1","title":"Chapter 1","startLocation": {"type":"dom-point","value":{"elementId":"ch_c1"}}}
  ],
  "assets": {
    "chapterEndpoint": "/api/reader/books/:bookId/chapters/:chapterId"
  }
}
```

**EPUB в MVP:**
- toc/chapters можно вернуть пустыми или минимальными — допустимо, если фронт читает TOC из epub.js.

**HTML-книги:**
- toc/chapters должны быть.

---

### 1.4 Chapter endpoint (HTML)
`GET /api/reader/books/:bookId/chapters/:chapterId`

Ответ:
```json
{
  "chapterId": "c1",
  "title": "...",
  "html": "<section id=\"ch_c1\" data-chapter-id=\"c1\">...</section>"
}
```

Требования:
- HTML обязательно **sanitized**
- Никаких `<script>`, inline handlers, iframe.

---

### 1.5 Progress endpoints
`GET /api/reader/books/:bookId/progress`:
```json
{ "position": {"location": {...}, "chapterId":"c1", "bookProgress":0.37} }
```

`POST /api/reader/books/:bookId/progress` Body:
```json
{ "position": { ...ReadingPosition... } }
```

Поведение:
- Upsert по (userId, bookId)

---

### 1.6 Annotations endpoints

`GET /api/reader/books/:bookId/annotations` → `Annotation[]`

`POST /api/reader/books/:bookId/annotations` Body:
```json
{
  "type": "bookmark|highlight|note",
  "location": { ... },
  "range": { ... },
  "quote": "...",
  "payload": {
    "label": "...",
    "note": "...",
    "color": "#...",
    "tags": ["..."]
  }
}
```

`PATCH /api/reader/books/:bookId/annotations/:id` Body: частичный апдейт

`DELETE ...` — удалить.

Правила:
- bookmark требует `location`
- highlight/note требуют `range`

---

### 1.7 AI endpoint (MVP)
`POST /api/ai/run`

Body:
```json
{
  "bookId": "...",
  "feature": "summarizeChapter|explainSelection|summarizeAround",
  "chapterId": "c1",
  "selection": { "text": "...", "range": {"start":...,"end":...} },
  "location": { ... },
  "window": { "approxChars": 2000, "approxBlocks": 6, "direction": "both" },
  "allowCache": true
}
```

Response:
```json
{
  "text": "...",
  "meta": {
    "cached": false,
    "model": "...",
    "feature": "summarizeChapter",
    "chapterId": "c1"
  },
  "citations": [
    {"range": {"start":...,"end":...}, "quote": "..."}
  ]
}
```

MVP-логика:
- `summarizeChapter`: получить текст главы → обрезать по лимиту → prompt → Ollama → кешировать
- `explainSelection`: использовать selection.text + небольшой контекст вокруг (если доступен)
- `summarizeAround`: взять текст вокруг location через text_map

Ограничения:
- max input chars (рекоменд. 20k–40k)
- таймаут
- ошибки: понятный JSON `{code,message}`

---

## 2) Backend — pipeline конвертации в normalized HTML (MVP)

### 2.1 Выходные артефакты
Для doc/docx/fb2/txt (и html) хранить:
```
/uploads/<userId>/<bookId>/
  original.ext
  derived/
    normalized.html
    chapters.json
    toc.json
    text_map.json
```

### 2.2 Требования к normalized HTML
- каждая глава: `<section id="ch_<chapterId>" data-chapter-id="<chapterId>">`
- каждый параграф: `<p id="p_<chapterId>_<indexPadded>" data-p-index="<index>">` (например 6 цифр)
- стабильность id: при повторной конвертации одинакового текста id не должен "прыгать"

### 2.3 text_map.json (для ИИ)
Формат:
```json
{
  "chapters": {
    "c1": {
      "title": "...",
      "blocks": [
        {"blockId":"b1","elementId":"p_c1_000001","order":1,"text":"..."}
      ]
    }
  }
}
```

### 2.4 Минимальные функции сервиса контента
- `getChapterHtml(bookId, chapterId)`
- `getChapterText(bookId, chapterId)`
- `getTextAroundDomPoint(bookId, domPoint, window)`
  - найти block по elementId
  - взять N блоков до/после

---

## 3) Drizzle Schema (предлагаемая реализация)

Ниже — пример схем для `drizzle-orm/pg-core`. Подстрой под существующие таблицы `users`, `books` и auth.

### 3.1 `reading_progress`
```ts
import { pgTable, uuid, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const readingProgress = pgTable("reading_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  bookId: uuid("book_id").notNull(),
  position: jsonb("position").notNull(), // ReadingPosition
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uq: uniqueIndex("reading_progress_user_book_uq").on(t.userId, t.bookId),
}));
```

### 3.2 `annotations`
```ts
import { pgEnum, pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const annotationTypeEnum = pgEnum("annotation_type", ["bookmark", "highlight", "note"]);

export const annotations = pgTable("annotations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  bookId: uuid("book_id").notNull(),
  type: annotationTypeEnum("type").notNull(),

  // for bookmark
  location: jsonb("location"),
  // for highlight/note
  range: jsonb("range"),

  quote: text("quote"),
  payload: jsonb("payload").notNull().default({}),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byUserBook: index("annotations_user_book_idx").on(t.userId, t.bookId),
}));
```

Валидация на уровне сервиса:
- `bookmark` → location required
- `highlight/note` → range required

### 3.3 `ai_cache`
```ts
import { pgTable, uuid, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const aiCache = pgTable("ai_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  bookId: uuid("book_id").notNull(),
  feature: text("feature").notNull(),
  key: text("key").notNull(),
  responseText: text("response_text").notNull(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uq: uniqueIndex("ai_cache_user_book_feature_key_uq").on(t.userId, t.bookId, t.feature, t.key),
}));
```

---

## 4) Drizzle migrations (шаблон)

### 4.1 Up migration (SQL логика)
1) Create enum:
```sql
CREATE TYPE "annotation_type" AS ENUM ('bookmark','highlight','note');
```
2) Create `reading_progress`:
```sql
CREATE TABLE "reading_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "book_id" uuid NOT NULL,
  "position" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "reading_progress_user_book_uq" UNIQUE ("user_id","book_id")
);
```
3) Create `annotations`:
```sql
CREATE TABLE "annotations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "book_id" uuid NOT NULL,
  "type" "annotation_type" NOT NULL,
  "location" jsonb,
  "range" jsonb,
  "quote" text,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "annotations_user_book_idx" ON "annotations" ("user_id","book_id");
```
4) Create `ai_cache`:
```sql
CREATE TABLE "ai_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "book_id" uuid NOT NULL,
  "feature" text NOT NULL,
  "key" text NOT NULL,
  "response_text" text NOT NULL,
  "meta" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ai_cache_user_book_feature_key_uq" UNIQUE ("user_id","book_id","feature","key")
);
```

### 4.2 Down migration
- drop tables `ai_cache`, `annotations`, `reading_progress`
- drop type `annotation_type`

---

## 5) Backend — структура модулей (рекомендуемая)

```
server/
  routes/
    reader.ts
    ai.ts
  services/
    readerService.ts
    annotationService.ts
    progressService.ts
    aiService.ts
    contentPipeline/
      normalizeHtml.ts
      buildToc.ts
      buildTextMap.ts
  db/
    schema.ts   // drizzle tables
    index.ts
```

Роуты должны быть тонкими, логика — в сервисах.

---

## 6) Frontend — полная спецификация

### 6.1 Роуты (Wouter)
- `/read/:bookId` → `ReaderPage`

---

### 6.2 Основной Layout ReaderPage
Desktop:
- TopBar fixed
- Left Drawer: TOC
- Center: ReaderViewport
- Right Drawer: Tabs (AI / Notes / Highlights / Bookmarks)

Mobile:
- TopBar
- ReaderViewport
- Drawers как fullscreen/bottom sheet

---

### 6.3 UI компоненты (обязательно)

#### TopBar
- Back
- Title + current chapter
- progress %
- buttons: TOC, Notes, AI, Settings

#### LeftDrawer: TOC
- список глав (плоский в MVP)
- клик → `adapter.goTo(location)`

#### ReaderViewport
- `adapter.mount(container)`
- выбор адаптера по `manifest.engine`

#### SelectionToolbar
Появляется при выделении:
- Highlight
- Note
- Explain (AI)
- Copy

Note → Radix Dialog

#### RightDrawer Tabs
- AI
- Notes
- Highlights
- Bookmarks

AI tab:
- quick actions:
  - Summarize chapter
  - Explain selection
  - Help around here
- area ответов

Annotations tabs:
- list items
- click → goTo
- delete

#### SettingsDialog
- theme: light/dark/sepia
- font size
- save to localStorage
- apply via `adapter.setSettings()`

---

### 6.4 Библиотеки (использовать)
- Router: Wouter
- Data/cache: @tanstack/react-query
- UI: Radix UI (Dialog, Tabs, Accordion/Collapsible, DropdownMenu, Tooltip)
- Styling: Tailwind
- EPUB: react-reader + epub.js (или epub.js напрямую)

---

### 6.5 ReaderAdapter контракты (использовать как baseline)
Использовать контракт интерфейсов, ранее переданный (ReaderAdapter + events + text extraction).

Минимум 2 адаптера:
- `EpubAdapter`
- `HtmlAdapter`

Оба должны поддерживать:
- `mount/unmount/load`
- `getPosition/goTo`
- `getToc/getChapters/getCurrentChapter`
- `getSelection/clearSelection`
- `getTextAround/getChapterText` (best-effort)
- events: positionChanged, selectionChanged, error

---

### 6.6 React Query keys (рекомендуемые)
- `reader.manifest(bookId)`
- `reader.progress(bookId)`
- `reader.annotations(bookId)`

Mutations:
- `saveProgress`
- `createAnnotation`
- `updateAnnotation`
- `deleteAnnotation`
- `runAi`

---

### 6.7 Автосохранение прогресса
- На `positionChanged` обновлять локально
- Отправка на backend debounce 1–3 сек
- Best effort save on unmount/beforeunload

---

## 7) Frontend — структура модулей (рекомендуемая)

```
client/src/features/reader/
  ReaderPage.tsx
  components/
    TopBar.tsx
    ReaderViewport.tsx
    TocDrawer.tsx
    RightDrawer.tsx
    AiPanel.tsx
    AnnotationList.tsx
    SelectionToolbar.tsx
    SettingsDialog.tsx
  adapters/
    ReaderAdapter.ts
    EpubAdapter.ts
    HtmlAdapter.ts
  hooks/
    useReaderController.ts
    useReaderProgress.ts
    useAnnotations.ts
    useAiAssist.ts
```

---

## 8) Acceptance Criteria (Phase 1)

1) Открытие `/read/:bookId` грузит manifest/progress/annotations, восстанавливает позицию.
2) TOC показывает главы и позволяет переходить.
3) Selection toolbar: highlight/note/copy работает.
4) Bookmark/Highlight/Note сохраняются в БД и отображаются.
5) Клик по аннотации переводит в нужное место.
6) AI:
   - summarizeChapter возвращает ответ и кешируется
   - explainSelection работает по выделению
   - helpAround работает по текущей позиции
7) Нет доступа к чужим книгам.

---

## 9) Phase 2 (после MVP)
- Spoiler after here (safe/soft/full)
- AI streaming (SSE)
- Search
- PDF read-only
- Более точные citations (range+quote)

---

## 10) Чек-лист передачи (Deliverables)

Backend:
- Реализованные роуты + сервисы
- Drizzle schema + migrations
- Pipeline для derived HTML + text_map
- README по структуре derived и примерам запросов

Frontend:
- ReaderPage + адаптеры + UI компоненты
- React Query интеграция
- Автосохранение прогресса
- Аннотации + AI панель

