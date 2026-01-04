# Frontend MVP ONLY (Phase 1) — ТЗ для Qoder

Цель: быстро выкатить рабочий модуль чтения с ИИ-ценностью. Без поиска, без PDF, без стриминга.

---

## 1) Что входит в MVP

Форматы:
- **EPUB** (через `react-reader + epub.js`)
- **HTML-контент** (DOC/DOCX/FB2/TXT уже конвертированы backend’ом в normalized HTML)

Фичи:
- Открытие книги `/read/:bookId`
- Восстановление последней позиции
- Прогресс чтения + автосохранение
- Выделение текста
- Аннотации:
  - Bookmark (на текущей позиции)
  - Highlight (по выделению)
  - Note (по выделению)
- Списки аннотаций и переход по клику
- ИИ-панель:
  - Summarize chapter
  - Explain selection
  - Help around here (контекст вокруг места)

Что НЕ входит:
- Поиск по книге
- PDF
- Spoiler after here (перенести в Phase 2)
- Streaming AI (перенести в Phase 2)

---

## 2) Пользовательский путь MVP

1) Клик по книге → `/read/:bookId`
2) Loader → загрузка `manifest + progress + annotations`
3) Автопереход к последней позиции
4) Чтение → прогресс обновляется, сохраняется debounce
5) Выделение → toolbar → highlight/note или AI explain
6) Открытие панели Notes/Highlights/Bookmarks → переход по клику
7) AI panel:
   - Summarize chapter
   - Explain selection
   - Help around here

---

## 3) UI компоненты MVP

### 3.1 TopBar (fixed)
- Back
- Title (коротко)
- Chapter title (если доступно)
- Progress (процент)
- Кнопки:
  - TOC (left drawer)
  - Notes (right drawer на вкладку Notes)
  - AI (right drawer на вкладку AI)
  - Settings

### 3.2 Left Drawer: TOC
- Список глав (плоский список достаточно)
- Клик → `goTo(location)`

### 3.3 ReaderViewport
- Контейнер для `ReaderAdapter.mount()`
- Поддержка хотя бы `scrolled` (paginated можно, если просто)
- Рендер highlights (если engine поддерживает)

### 3.4 Selection Toolbar
Кнопки:
- Highlight
- Note
- Explain (AI)
- Copy

Note → Dialog с вводом заметки.

### 3.5 Right Drawer (Tabs)
Tabs:
- AI
- Notes
- Highlights
- Bookmarks

AI tab:
- Кнопка “Summarize chapter”
- Кнопка “Explain selection” (если selection есть)
- Кнопка “Help around here”
- Область вывода ответа

Notes/Highlights/Bookmarks:
- список элементов
- клик → goTo
- delete

### 3.6 Settings (Dialog)
- Theme light/dark/sepia
- Font size slider
Сохранение: localStorage.

---

## 4) Библиотеки (MVP)
- Routing: **Wouter**
- Data: **@tanstack/react-query**
- UI: **Radix UI** (Dialog, Tabs, Accordion/Collapsible, Tooltip, Dropdown)
- Styling: **Tailwind**
- EPUB: **react-reader + epub.js**

---

## 5) Минимальные frontend API вызовы

React Query keys:
- `reader.manifest(bookId)`
- `reader.progress(bookId)`
- `reader.annotations(bookId)`

Endpoints (предполагаемые):
- `GET /api/reader/books/:bookId/manifest`
- `GET /api/reader/books/:bookId/progress`
- `POST /api/reader/books/:bookId/progress`
- `GET /api/reader/books/:bookId/annotations`
- `POST /api/reader/books/:bookId/annotations`
- `DELETE /api/reader/books/:bookId/annotations/:id`
- `POST /api/ai/run`

---

## 6) Технические требования MVP

### 6.1 ReaderAdapter
Должны быть минимум два адаптера:
- `EpubAdapter`
- `HtmlAdapter`

Оба должны поддерживать:
- `mount/unmount/load`
- `getPosition/goTo`
- `getToc/getChapters/getCurrentChapter`
- `getSelection/clearSelection`
- `getTextAround/getChapterText` (best-effort)
- события: `positionChanged`, `selectionChanged`, `error`

### 6.2 Прогресс
- Обновлять прогресс при `positionChanged`
- Сохранение на backend debounce 1–3 сек
- Best-effort save при уходе со страницы

### 6.3 Аннотации
- Bookmark: создавать по текущей позиции
- Highlight/Note: создавать по selection range
- После успешного create → обновить query cache и отрендерить

### 6.4 AI
- В MVP без стрима, обычный `POST /api/ai/run`
- Три действия:
  - summarizeChapter
  - explainSelection
  - contextAroundLocation

---

## 7) Definition of Done (MVP)

1) `/read/:bookId` открывает книгу, восстанавливает последнюю позицию.
2) TOC показывает главы и позволяет переходить.
3) Selection toolbar работает: highlight/note/copy.
4) Bookmark/Highlight/Note сохраняются и видны в списках.
5) Клик по аннотации переводит в нужное место.
6) AI panel:
   - Summarize chapter возвращает ответ
   - Explain selection работает по выделению
   - Help around here работает без выделения
7) Настройки применяются и сохраняются локально.

