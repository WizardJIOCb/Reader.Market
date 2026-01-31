ТЗ для Qoder: “Accurate Reading Position v2 (global char offset + page-map)”
Acceptance Criteria

Открываю книгу на другом экране/шрифте/ориентации → возвращает на тот же текст, а не “примерно”.

После ресайза/смены настроек позиция не “прыгает” на другую главу/страницу.

Система совместима с текущим API (старые поля не ломаем), но добавляем locator v2.

1) Изменения типов (frontend)
src/components/reader/types.ts

Добавить новые интерфейсы:

export interface PageMapItem {
  html: string;      // HTML страницы
  text: string;      // plainText страницы (нормализованный как в ReaderEngine)
  startChar: number; // offset в chapter.plainText (включая)
  endChar: number;   // offset в chapter.plainText (исключая)
}

export interface ReadingLocatorV2 {
  v: 2;
  bookId: string;
  chapterIndex: number;

  // главный ключ:
  charOffsetInBook: number;
  charOffsetInChapter: number;

  percentage: number;

  // подсказки/страховки:
  pageHintInChapter?: number;
  totalPagesHintInChapter?: number;
  anchorText?: string;

  viewport?: {
    w: number;
    h: number;
    fontSize: number;
    lineHeight: number;
    margins: number;
    fontFamily: string;
    viewMode: 'paginated' | 'scroll';
  };

  updatedAt: string; // ISO
}

2) Page-map + global offset в ReaderCore
src/components/reader/ReaderCore.tsx
2.1. Изменить pagesRef и paginateHTML чтобы возвращал PageMapItem[]

pagesRef должен хранить не string[], а PageMapItem[]

paginateHTML(...) возвращает массив объектов {html,text,startChar,endChar}

Ключевой момент: text должен нормализоваться так же, как plainText в ReaderEngine (там часто replace(/\s+/g,' ').trim()). Поэтому используем простую нормализацию без “умных” замен пунктуации, иначе длины съедут.

Пример готового normalizePlainText:

function normalizePlainText(text: string): string {
  return (text || '')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim();
}

2.2. При смене страницы обновлять Position.charOffset как global offset

В эффекте “Update position when page changes”:

берём pageMap = pagesRef.current[currentPage]

chapterLocalOffset = pageMap.startChar

position.charOffset = currentChapter.startOffset + chapterLocalOffset

2.3. Добавить метод goToCharOffset в ReaderCoreHandle

Новый метод делает восстановление по глобальному смещению + fallback по anchorText.

Сигнатура:

goToCharOffset: (
  charOffsetInBook: number,
  opts?: { anchorText?: string; chapterIndexHint?: number; pageHintInChapter?: number }
) => Promise<boolean>;


Логика:

clamp в [0..content.totalChars]

найти главу по chapter.startOffset/endOffset

localOffset = clamped - chapter.startOffset

если глава другая — переключить главу и дождаться пагинации

найти страницу по диапазону startChar/endChar

если anchorText задан и не совпал — поискать страницу, где page.text включает anchor

поставить setCurrentPage(pageIdx)

3) Сохранение/восстановление в Reader.tsx
src/pages/Reader.tsx (или где у тебя Reader container)
3.1. При любом onPositionChange сохранять locator v2

Формируем locator: ReadingLocatorV2 (v=2)

Пишем в localStorage reading-progress-${bookId}

В API отправляем тот же объект (не ломая старые поля)

Anchor берём из chapter.plainText вокруг charOffsetInBook:

const start = Math.max(0, local - 40);
const end = Math.min(chapter.plainText.length, local + 160);
anchorText = chapter.plainText.substring(start, end).replace(/[\s\u00a0]+/g,' ').trim();

3.2. При загрузке прогресса сначала пробовать locator v2

Если progress.locator?.v === 2 → вызываем:

readerRef.current?.goToCharOffset(locator.charOffsetInBook, {
  anchorText: locator.anchorText,
  chapterIndexHint: locator.chapterIndex,
  pageHintInChapter: locator.pageHintInChapter,
});


Если locator нет — fallback:

либо по percentage → offset = totalChars * percentage

либо старый goToPosition как сейчас (best-effort)

Готовые патчи (минимально-инвазивно)

Ниже — те изменения, которые уже “вклеиваются” почти 1-в-1.

A) ReaderCore: pagesRef + scroll mode page-map
// было:
// const pagesRef = useRef<string[]>([]);

// стало:
const pagesRef = useRef<PageMapItem[]>([]);
const currentChapterIndexRef = useRef<number>(0);

useEffect(() => {
  if (currentChapter) currentChapterIndexRef.current = currentChapter.index;
}, [currentChapter]);

// scroll mode:
pagesRef.current = [{
  html: currentChapter.content,
  text: normalizePlainText(currentChapter.plainText || ''),
  startChar: 0,
  endChar: (currentChapter.plainText || '').length,
}];

B) ReaderCore: position update (global charOffset)
const pageMap = pagesRef.current[currentPage];
const chapterLocalOffset = (settings.viewMode === 'paginated' && pageMap) ? pageMap.startChar : 0;

const position: Position = {
  charOffset: currentChapter.startOffset + chapterLocalOffset,
  chapterIndex,
  pageInChapter: currentPage,
  totalPagesInChapter: totalPages,
  percentage,
};

C) ReaderCore: goToCharOffset (готовая версия)
const goToCharOffset = useCallback(
  async (
    charOffsetInBook: number,
    opts?: { anchorText?: string; chapterIndexHint?: number; pageHintInChapter?: number }
  ): Promise<boolean> => {
    if (!content) return false;

    const clamped = Math.max(0, Math.min(charOffsetInBook, content.totalChars));

    // 1) Find chapter by offsets
    let chapterIndex = content.chapters.findIndex(
      ch => clamped >= ch.startOffset && clamped < ch.endOffset
    );

    if (chapterIndex === -1) {
      chapterIndex = content.chapters.length - 1;
    }

    const chapter = content.chapters[chapterIndex];
    if (!chapter) return false;

    const localOffset = Math.max(0, clamped - chapter.startOffset);

    // 2) Switch chapter if needed
    const isChapterChange = currentChapterIndexRef.current !== chapterIndex;
    if (isChapterChange) {
      setCurrentChapter(chapter);
      onChapterChange?.(chapter);

      // wait pagination
      await new Promise(r => setTimeout(r, 50));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined))));
      await new Promise(r => setTimeout(r, 150));
    }

    // 3) Scroll mode: approximate by ratio
    if (settings.viewMode === 'scroll') {
      const el = contentRef.current;
      if (el) {
        const ratio = chapter.plainText ? (localOffset / Math.max(1, chapter.plainText.length)) : 0;
        el.scrollTop = ratio * el.scrollHeight;
      }
      setCurrentPage(0);
      return true;
    }

    const pages = pagesRef.current;
    if (!pages || pages.length === 0) {
      setCurrentPage(0);
      return false;
    }

    // 4) Find page by range
    let pageIdx = pages.findIndex(p => localOffset >= p.startChar && localOffset < p.endChar);
    if (pageIdx === -1) {
      let best = 0;
      for (let i = 0; i < pages.length; i++) if (pages[i].startChar <= localOffset) best = i;
      pageIdx = best;
    }

    // 5) Anchor fallback
    if (opts?.anchorText && opts.anchorText.trim().length > 10) {
      const needle = opts.anchorText.replace(/[\s\u00a0]+/g, ' ').trim().substring(0, 200);
      if (needle) {
        const targetPageText = (pages[pageIdx]?.text || '').replace(/[\s\u00a0]+/g,' ').trim();
        if (!targetPageText.includes(needle)) {
          const found = pages.findIndex(p => (p.text || '').includes(needle));
          if (found !== -1) pageIdx = found;
        }
      }
    }

    setCurrentPage(Math.max(0, Math.min(pageIdx, pages.length - 1)));
    return true;
  },
  [content, settings.viewMode, onChapterChange]
);

D) Reader.tsx: сохранение locator v2 (кусок)
const buildAnchorText = useCallback((content: BookContent | null, chapterIndex: number, charOffsetInBook: number) => {
  if (!content) return undefined;
  const chapter = content.chapters[chapterIndex];
  if (!chapter?.plainText) return undefined;

  const local = Math.max(0, charOffsetInBook - (chapter.startOffset || 0));
  const start = Math.max(0, local - 40);
  const end = Math.min(chapter.plainText.length, local + 160);
  const snippet = chapter.plainText.substring(start, end).replace(/[\s\u00a0]+/g, ' ').trim();
  return snippet.length ? snippet : undefined;
}, []);

const chapterStartOffset = bookContent?.chapters?.[position.chapterIndex]?.startOffset ?? 0;
const charOffsetInBook = position.charOffset;
const charOffsetInChapter = Math.max(0, charOffsetInBook - chapterStartOffset);

const locator: ReadingLocatorV2 = {
  v: 2,
  bookId,
  chapterIndex: position.chapterIndex,
  charOffsetInBook,
  charOffsetInChapter,
  percentage: position.percentage,
  pageHintInChapter: position.pageInChapter,
  totalPagesHintInChapter: position.totalPagesInChapter,
  anchorText: buildAnchorText(bookContent, position.chapterIndex, charOffsetInBook),
  viewport: {
    w: window.innerWidth,
    h: window.innerHeight,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    margins: settings.margins,
    fontFamily: settings.fontFamily,
    viewMode: settings.viewMode,
  },
  updatedAt: new Date().toISOString(),
};

const progressData = {
  currentPage: currPageOverall,
  totalPages: totPagesOverall,
  percentage: position.percentage,
  chapterIndex: position.chapterIndex,
  locator,
};

localStorage.setItem(`reading-progress-${bookId}`, JSON.stringify(progressData));
await readerApi.updateProgress(bookId, progressData);

E) Reader.tsx: восстановление через goToCharOffset
const locator: ReadingLocatorV2 | undefined =
  (progress.locator && progress.locator.v === 2) ? progress.locator : undefined;

if (locator && typeof locator.charOffsetInBook === 'number') {
  setTimeout(() => {
    readerRef.current?.goToCharOffset(locator.charOffsetInBook, {
      anchorText: locator.anchorText,
      chapterIndexHint: locator.chapterIndex,
      pageHintInChapter: locator.pageHintInChapter,
    }).catch(() => {});
  }, 150);
  return;
}

Backend (минимальный апдейт, чтобы тоже было точно)

Сейчас в reading_progress нет явного charOffset. Самый быстрый путь без миграций:

хранить locator в reading_progress.settings JSONB: settings.readingLocatorV2 = {...}
или добавить колонки:

char_offset_in_book INT

char_offset_in_chapter INT

locator JSONB

Важно: оставь старые поля (current_page/percentage) — они полезны для UI, но восстановление делай по locator.