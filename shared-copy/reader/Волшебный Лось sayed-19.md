Посмотрел последние файлы (ReaderCore.tsx, Reader.tsx, ReaderEngine.ts, textNormalization.ts, types.ts). По ним видно, что фикс сейчас НЕ “железобетонный” — по сути он откатился к старой логике и не может гарантировать точное восстановление позиции.

Что сейчас не так (по факту в коде)
1) ReaderCore.tsx вообще не считает “точную позицию”

В useEffect “Update position when page changes” формируется:

charOffset: currentChapter.startOffset (то есть всегда начало главы, независимо от текущей страницы)

pagesRef — useRef<string[]>([])

paginateHTML() возвращает string[] (HTML страниц), без startChar/endChar

Итог: невозможно восстановить точное место при смене экрана/шрифта, потому что вы сохраняете не “символьный оффсет внутри книги”, а “начало текущей главы”.

2) Reader.tsx сохраняет только % и “оценочные страницы”

Сейчас в handlePositionChange сохраняется:

currentPageOverall/totalPagesOverall

percentage

chapterIndex

Но не сохраняется ReadingLocatorV2 (charOffsetInBook + anchorText + pageHintInChapter).
То есть “точной привязки” нет, восстановление опять будет плавать.

3) ReaderEngine.ts: EPUB-индексация всё ещё может быть “дырявая”

В EPUB-парсинге используется index: i где i — индекс элемента spine. Если некоторые spine-элементы пропускаются (continue), индексы глав получаются не плотные (могут быть 0,1,4,7…). Это как раз тот инвариант, о котором писал “senior”: chapter.index === arrayIndex должно быть гарантировано.

Что передать Qoder прямо сейчас (коротко)

Текущая версия не решает задачу точного восстановления, потому что charOffset не зависит от страницы и не существует page-map с startChar/endChar.

Нужно внедрять “V2-локатор” (charOffsetInBook + anchorText) и page-map на уровне ReaderCore, иначе любые изменения layout будут ломать восстановление.

Patch plan (plug-and-play) — что делать по коммитам

Ниже — план, который можно просто скопировать в Qoder как задачу/чеклист.

Commit 1 — Типы (V2-локатор + page-map)

Файл: types.ts

Добавить/зафиксировать:

PageMapItem:

html: string

text: string (канонизированный plain text страницы)

startChar: number (offset в канонизированном plainText главы)

endChar: number (exclusive)

ReadingLocatorV2:

version: 2

bookId

chapterIndex

charOffsetInBook (global offset по книге)

charOffsetInChapter

pageHintInChapter

anchorText (например 80–160 символов вокруг позиции, канонизированных)

createdAt

Commit 2 — Единая нормализация текста (каноникализация)

Файл: textNormalization.ts

Оставить/докрутить canonicalizeForOffsets() так, чтобы:

нормализует \u00A0, \r\n, табы → пробел

схлопывает множественные пробелы

важно: договориться, делаем ли .trim()

Если .trim() остаётся, то boundary-space фикс надо делать не через “trim” (см. Commit 4) — добавлять пробелы как “внутренние” между блоками.

Commit 3 — ReaderEngine: индексы глав + текст главы = тот же канон

Файл: ReaderEngine.ts

3.1 Гарантировать плотные индексы (особенно EPUB)

В EPUB-парсинге заменить index: i на index: chapterIdx:

завести let chapterIdx = 0

инкрементировать только когда реально добавили главу

chapters.push({ index: chapterIdx, ... }), затем chapterIdx++

3.2 Везде считать plainText через один и тот же механизм

Сейчас EPUB делает body.textContent и replace(/\s+/g, ' '). Это будет расходиться с тем, как ReaderCore режет страницы (если он будет использовать структурное извлечение).

Нужно:

вынести общий extractStructuredTextFromHTML(html): string

прогонять через canonicalizeForOffsets

charCount = plainText.length

startOffset/endOffset считать по длине канонизированного plainText

Commit 4 — ReaderCore: paginateHTML -> PageMapItem[] (ключевой коммит)

Файл: ReaderCore.tsx

4.1 pagesRef должен хранить page-map

Заменить:

const pagesRef = useRef<string[]>([])
на:

const pagesRef = useRef<PageMapItem[]>([])

4.2 paginateHTML должен возвращать PageMapItem[]

Из paginateHTML(): string[] сделать paginateHTML(): PageMapItem[]:

Логика:

идём по block-level элементам в правильном DOM-порядке

для каждого элемента получаем:

elementHtml = el.outerHTML

elementText = canonicalizeForOffsets(el.textContent || '')

складываем в текущую страницу:

currentHtml += elementHtml

currentText += (currentText ? ' ' : '') + elementText ← пробел между блоками

если элемент не помещается по высоте:

пушим страницу как PageMapItem { html, text, startChar, endChar }

cursor += currentText.length

начинаем новую страницу с этого элемента

4.3 Boundary spacing fix (межстраничный пробел)

Критичный момент: если разрыв страницы произошёл между блоками, а в “общем тексте главы” между ними есть пробел, то page-map должен это отражать.

Правило:

когда пушим страницу и следующая страница начинается новым блоком, обеспечить, что между ними в page-map есть ровно один пробел.

вариант реализации:

перед pushPage() если currentText не пуст и следующий блок будет на новой странице — добавить в currentText ' ' (только если не заканчивается пробелом), и увеличить cursor/endChar.

при этом следить за инвариантом (endChar - startChar) === text.length

4.4 В render currentContent использовать .html

Сейчас currentContent берёт объект/строку. Должно быть так:

currentContent = pagesRef.current[currentPage]?.html ?? currentChapter?.content ?? ''

Commit 5 — ReaderCore: правильный Position.charOffset (global)

В “Update position when page changes” заменить:

charOffset: currentChapter.startOffset

на:

взять pageStart = pagesRef.current[currentPage]?.startChar ?? 0

charOffset: currentChapter.startOffset + pageStart

Это и есть “первый символ текущей страницы” в канонизированном тексте книги.

Commit 6 — ReaderCoreHandle: goToCharOffset()

Добавить метод:

goToCharOffset(charOffsetInBook, opts?: { anchorText?, pageHintInChapter? })

Алгоритм:

найти главу по startOffset/endOffset

local = charOffsetInBook - chapter.startOffset

гарантировать, что pagesRef уже построен (если нет — построить)

найти страницу, где startChar <= local < endChar

перейти на неё

(опционально) проверить anchorText: если на найденной странице текст слишком не совпадает — искать ближайшую страницу вокруг (±2..±5)

Commit 7 — Reader.tsx: сохранять V2-локатор и восстанавливать через него

Файл: Reader.tsx

7.1 На каждое изменение позиции формировать locatorV2

Сохранять:

charOffsetInBook = position.charOffset (после Commit 5 это уже глобальный)

chapterIndex

charOffsetInChapter = charOffsetInBook - chapter.startOffset

pageHintInChapter = position.pageInChapter

anchorText — взять из bookContent.chapters[chapterIndex].plainText с окна вокруг charOffsetInChapter (например ±80 символов) и прогнать через canonicalizeForOffsets

7.2 Восстановление

При открытии книги:

если есть locatorV2 → readerRef.current.goToCharOffset(locator.charOffsetInBook, { anchorText, pageHintInChapter })

иначе fallback на старое (percentage/pageInChapter)

Commit 8 — Backend: хранить locator в reading_progress.settings._progress

Файл: routes.ts (и где у вас updateProgress)

принять locator?: ReadingLocatorV2

писать в reading_progress.settings._progress = locator не затирая остальные настройки

возвращать locator назад клиенту

Commit 9 — Мини-acceptance tests

Сценарии:

открыть → середина → закрыть/refresh → открыть → тот же абзац

открыть → середина → сменить ширину окна → тот же абзац

открыть → середина → поменять font/margins → тот же абзац

EPUB с “грязной” разметкой → всё ок

Главное резюме по текущему “фиксу”

С тем, что сейчас в файлах, ответ: нет, не всё правильно — потому что:

ReaderCore не вычисляет глобальный charOffset по странице (он равен startOffset главы)

нет PageMapItem(startChar/endChar) → нечем восстановить “первый символ страницы”

Reader.tsx не сохраняет V2-локатор

EPUB индекс может быть не плотным

Если хочешь, я могу прямо по твоим файлам накидать точечные диффы (кусочки кода) для каждого коммита (особенно для paginateHTML -> PageMapItem[] и charOffset), чтобы Qoder просто вставил и не думал.

Давай
Думал на протяжении 12s

Ок, делаю точечные дифф-вставки (plug-and-play), чтобы Qoder мог просто копировать блоки и заменить по “якорям” в файлах. Я даю патчи так, чтобы они применялись по поиску строк (без привязки к номерам).

Формат: PATCH N → файл → “найти блок / заменить блок / вставить рядом”.

PATCH 1 — types.ts: PageMapItem + ReadingLocatorV2

Файл: types.ts
Вставить (если ещё нет) рядом с интерфейсами Position/ReaderSettings (любое место в types):

export interface PageMapItem {
  html: string;
  text: string;        // canonicalized plain text for offsets
  startChar: number;   // inclusive, offset in chapter.plainText
  endChar: number;     // exclusive, offset in chapter.plainText
}

export interface ReadingLocatorV2 {
  version: 2;
  bookId: string;

  // indices
  chapterIndex: number;

  // global offsets
  charOffsetInBook: number;

  // local offsets
  charOffsetInChapter: number;

  // hints (optional but useful)
  pageHintInChapter?: number;

  // anchor (canonicalized snippet around position)
  anchorText?: string;

  createdAt: string; // ISO
}

PATCH 2 — textNormalization.ts: canonicalize + extractStructuredText

Файл: textNormalization.ts
Если уже есть canonicalizeForOffsets — проверь, что нет toLowerCase и есть нормализация пробелов.
Если extractStructuredText нет — добавить:

export function canonicalizeForOffsets(input: string): string {
  if (!input) return '';
  return input
    .replace(/\u00A0/g, ' ')      // nbsp -> space
    .replace(/\r\n?/g, '\n')      // normalize newlines
    .replace(/\t/g, ' ')
    .replace(/[ \f\v]+/g, ' ')
    .replace(/\n+/g, '\n')
    .replace(/[ ]*\n[ ]*/g, '\n') // trim spaces around newlines
    .trim();
}

/**
 * Extracts text from HTML in a way consistent with Reader pagination.
 * Requires DOM (browser). If no DOM, fallback should be used in Engine.
 */
export function extractStructuredText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  // Treat block elements as separated by space (like our pagination does)
  const blocks = Array.from(div.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre'));
  if (blocks.length === 0) {
    return canonicalizeForOffsets(div.textContent || '');
  }

  const parts: string[] = [];
  for (const el of blocks) {
    const t = canonicalizeForOffsets(el.textContent || '');
    if (t) parts.push(t);
  }
  return canonicalizeForOffsets(parts.join(' '));
}

PATCH 3 — ReaderEngine.ts: EPUB dense index + text from cleaned HTML + enforce index invariant
3.1 Dense indexing в EPUB (обязательно)

Найти в parseEPUB() похожий цикл:

for (let i = 0; i < spine.length; i++) {
  ...
  if (...) continue;
  ...
  const { title, html, text } = this.parseEPUBChapter(htmlContent, i);
  chapters.push({ index: i, ... });
}


Заменить на:

let chapterIdx = 0;

for (let i = 0; i < spine.length; i++) {
  const itemId = spine[i]?.idref;
  const manifestItem = manifest[itemId];
  if (!manifestItem || !manifestItem.mediaType?.includes('html')) continue;

  const contentFile = zip.file(manifestItem.href);
  if (!contentFile) continue;

  const htmlContent = await contentFile.async('string');

  // IMPORTANT: pass dense index
  const { title: chapterTitle, html, text } = this.parseEPUBChapter(htmlContent, chapterIdx);

  chapters.push({
    index: chapterIdx,
    title: chapterTitle,
    content: html,
    plainText: text,
    // charCount/startOffset/endOffset recalculated later in canonicalizeOffsets
  });

  chapterIdx++;
}

3.2 parseEPUBChapter: text из cleaned HTML (обязательно)

Найти parseEPUBChapter где делается body.textContent.
Заменить на:

private parseEPUBChapter(htmlContent: string, index: number): { title: string; html: string; text: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  const titleEl = doc.querySelector('h1, h2, title');
  const title = titleEl?.textContent?.trim() || `Chapter ${index + 1}`;

  const body = doc.body;
  let html = body?.innerHTML || '';

  // 1) clean html first (must match rendered html)
  html = this.cleanEPUBHTML(html);

  // 2) extract text from cleaned html consistently with ReaderCore
  let text = '';
  if (typeof document !== 'undefined') {
    text = extractStructuredText(html);
  } else {
    // fallback without DOM (rare for client)
    text = canonicalizeForOffsets((body?.textContent || ''));
  }

  return { title, html, text };
}


Убедись, что вверху файла есть импорты:

import { canonicalizeForOffsets, extractStructuredText } from './textNormalization';

3.3 canonicalizeOffsets: enforce index=i и пересчёт offsets (обязательно)

Найти canonicalizeOffsets(content) и заменить его “ядро” на:

public canonicalizeOffsets(content: BookContent): BookContent {
  // Force dense indices and canonical plainText
  const canonChapters = content.chapters.map((ch, i) => ({
    ...ch,
    index: i,
    plainText: canonicalizeForOffsets(ch.plainText || ''),
  }));

  // Recompute offsets sequentially from canonical text
  let offset = 0;
  const fixed = canonChapters.map((ch) => {
    const start = offset;
    const end = start + ch.plainText.length;
    offset = end;

    return {
      ...ch,
      charCount: ch.plainText.length,
      startOffset: start,
      endOffset: end,
    };
  });

  return {
    ...content,
    chapters: fixed,
    totalChars: offset,
  };
}

PATCH 4 — ReaderCore.tsx: PageMapItem pagination + pagesRef + charOffset global + goToCharOffset
4.1 pagesRef тип

Найти:

const pagesRef = useRef<string[]>([]);


Заменить:

const pagesRef = useRef<PageMapItem[]>([]);


Убедись, что PageMapItem импортирован из types.ts.

4.2 paginateHTML: вернуть PageMapItem[] (ключевой кусок)

Найти функцию paginateHTML(...) которая сейчас возвращает string[].
Заменить сигнатуру и внутренности на этот шаблон:

const paginateHTML = useCallback((chapterHtml: string, chapterPlainText: string) => {
  const pages: PageMapItem[] = [];
  let cursor = 0;

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.visibility = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.left = '-99999px';

  // IMPORTANT: use the same width/font settings as reader viewport
  // (Qoder: ensure container has same CSS classes / width as real page)
  container.innerHTML = chapterHtml;
  document.body.appendChild(container);

  const pushPage = (html: string, text: string) => {
    const canon = canonicalizeForOffsets(text);
    const startChar = cursor;
    const endChar = startChar + canon.length;
    pages.push({ html, text: canon, startChar, endChar });
    cursor = endChar;
  };

  // Take block-level elements in order
  const blocks = Array.from(container.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre'));

  let currentHTML = '';
  let currentText = '';

  // helper measuring by temporarily setting content
  const measureFits = (html: string): boolean => {
    const page = document.createElement('div');
    // TODO: apply page styles/constraints (height/width) same as reader page
    page.innerHTML = html;
    container.appendChild(page);

    // Qoder: replace with your real constraint logic: scrollHeight <= clientHeight etc
    const fits = page.scrollHeight <= page.clientHeight || page.clientHeight === 0;

    container.removeChild(page);
    return fits;
  };

  for (let i = 0; i < blocks.length; i++) {
    const el = blocks[i];
    const elHtml = el.outerHTML;
    const elText = canonicalizeForOffsets(el.textContent || '');

    const candidateHTML = currentHTML + elHtml;
    const candidateText = (currentText ? (currentText.endsWith(' ') ? '' : ' ') : '') + elText;
    const mergedText = (currentText || '') + candidateText;

    if (!currentHTML) {
      currentHTML = elHtml;
      currentText = elText;
      continue;
    }

    // if adding element overflows, flush current page
    // NOTE: If you already have a stable height-based pagination in your code,
    // keep it and only adapt pageMap + cursor behavior.
    const willOverflow = !measureFits(candidateHTML);

    if (willOverflow) {
      pushPage(currentHTML, currentText);

      // boundary separator: account for missing space between last block prev page and first block next page
      const lastPage = pages[pages.length - 1];
      if ((lastPage.text || '').length > 0 && elText.length > 0) {
        if (!((lastPage.text || '').endsWith(' '))) {
          lastPage.text = (lastPage.text || '') + ' ';
          lastPage.endChar += 1;
          cursor += 1;
        }
      }

      currentHTML = elHtml;
      currentText = elText;
    } else {
      currentHTML = candidateHTML;
      currentText = mergedText;
    }
  }

  if (currentHTML) pushPage(currentHTML, currentText);

  // final length sync with chapterPlainText length (canonical!)
  const expectedLen = canonicalizeForOffsets(chapterPlainText).length;
  if (pages.length > 0) {
    const last = pages[pages.length - 1];
    const needLen = Math.max(0, expectedLen - last.startChar);

    if (last.text.length > needLen) last.text = last.text.slice(0, needLen);
    else if (last.text.length < needLen) last.text = last.text.padEnd(needLen, ' ');

    last.endChar = expectedLen;
    cursor = expectedLen;
  }

  document.body.removeChild(container);

  return pages;
}, []);


⚠️ В этом шаблоне measureFits — заглушка: Qoder должен подставить ваш текущий механизм измерения высоты страницы (он у вас уже был). Главное: pageMap + cursor + boundary + final sync.

4.3 Рендер страницы: использовать .html

Найти, где строится контент страницы (обычно currentContent).

Должно быть:

const pageHtml = pagesRef.current[currentPage]?.html ?? '';


и выводить pageHtml, а не pagesRef.current[currentPage].

4.4 Единый emitPosition: global charOffset по странице

В ReaderCore.tsx внутри компонента добавить:

const emitPosition = useCallback(() => {
  if (!content || !currentChapter) return;

  const pages = pagesRef.current;
  const pageItem = pages?.[currentPage];

  const pageStartInChapter = pageItem?.startChar ?? 0;
  const charOffsetInBook = (currentChapter.startOffset ?? 0) + pageStartInChapter;

  const pos: Position = {
    chapterIndex: currentChapter.index,
    pageInChapter: currentPage,
    totalPagesInChapter: pages?.length ?? 0,
    charOffset: charOffsetInBook, // GLOBAL
    percentage: content.totalChars > 0 ? (charOffsetInBook / content.totalChars) * 100 : 0,
  };

  onPositionChange?.(pos);
}, [content, currentChapter, currentPage, onPositionChange]);


Вызывать emitPosition() после смены страницы/главы и после restore/goToCharOffset:

requestAnimationFrame(() => emitPosition());

4.5 goToCharOffset (ReaderCoreHandle)

В useImperativeHandle(ref, () => ({ ... })) добавить:

async goToCharOffset(charOffsetInBook: number, opts?: { anchorText?: string; pageHintInChapter?: number }) {
  if (!content) return;

  // 1) find chapter by offsets
  const chapters = content.chapters;
  const idx = chapters.findIndex(ch => ch.startOffset <= charOffsetInBook && charOffsetInBook < ch.endOffset);
  const chapter = idx >= 0 ? chapters[idx] : chapters[chapters.length - 1];
  if (!chapter) return;

  // 2) ensure this chapter loaded and paginated
  setCurrentChapter(chapter);

  // Wait next tick for chapter render, then build pages
  await new Promise(r => requestAnimationFrame(r));

  const pages = paginateHTML(chapter.content, chapter.plainText);
  pagesRef.current = pages;

  // 3) local offset in chapter
  const local = Math.max(0, charOffsetInBook - (chapter.startOffset ?? 0));

  // 4) find page by range (use hint if present)
  let pageIndex = -1;
  const hint = opts?.pageHintInChapter;
  if (typeof hint === 'number' && pages[hint]) {
    const p = pages[hint];
    if (p.startChar <= local && local < p.endChar) pageIndex = hint;
  }
  if (pageIndex < 0) {
    pageIndex = pages.findIndex(p => p.startChar <= local && local < p.endChar);
  }
  if (pageIndex < 0) pageIndex = Math.max(0, Math.min(pages.length - 1, hint ?? 0));

  setCurrentPage(pageIndex);
  await new Promise(r => requestAnimationFrame(r));

  // optional: anchor verification (lightweight)
  if (opts?.anchorText) {
    const anchor = canonicalizeForOffsets(opts.anchorText);
    const pageText = pages[pageIndex]?.text || '';
    if (anchor && pageText && !pageText.includes(anchor.slice(0, Math.min(anchor.length, 40)))) {
      // try neighbors
      for (let d = 1; d <= 3; d++) {
        const left = pageIndex - d;
        const right = pageIndex + d;
        if (left >= 0 && (pages[left]?.text || '').includes(anchor.slice(0, 40))) { setCurrentPage(left); break; }
        if (right < pages.length && (pages[right]?.text || '').includes(anchor.slice(0, 40))) { setCurrentPage(right); break; }
      }
    }
  }

  requestAnimationFrame(() => emitPosition());
}

PATCH 5 — Reader.tsx: сохранять locatorV2 и восстанавливать через него
5.1 handlePositionChange: строим locatorV2

В Reader.tsx в handlePositionChange(position) добавить формирование locator:

const chapter = bookContent?.chapters?.[position.chapterIndex];
const chapterStart = chapter?.startOffset ?? 0;
const charOffsetInBook = position.charOffset;
const charOffsetInChapter = Math.max(0, charOffsetInBook - chapterStart);

// anchor: ±80 symbols around local offset
const raw = chapter?.plainText || '';
const start = Math.max(0, charOffsetInChapter - 80);
const end = Math.min(raw.length, charOffsetInChapter + 80);
const anchorText = canonicalizeForOffsets(raw.slice(start, end));

const locator: ReadingLocatorV2 = {
  version: 2,
  bookId,
  chapterIndex: position.chapterIndex,
  charOffsetInBook,
  charOffsetInChapter,
  pageHintInChapter: position.pageInChapter,
  anchorText,
  createdAt: new Date().toISOString(),
};


И сохранить:

в localStorage

в API (вместо старого прогресса или вместе)

localStorage.setItem(`reader:${bookId}:locatorV2`, JSON.stringify(locator));

readerApi.updateProgress(bookId, {
  locator, // <- backend should store it in settings._progress
  // keep your legacy fields if you want
  chapterIndex: position.chapterIndex,
  percentage: position.percentage,
});

5.2 restore: приоритет locatorV2

При загрузке книги:

const raw = localStorage.getItem(`reader:${bookId}:locatorV2`);
const loc = raw ? (JSON.parse(raw) as ReadingLocatorV2) : null;

if (loc?.version === 2) {
  const p = readerRef.current?.goToCharOffset(loc.charOffsetInBook, {
    anchorText: loc.anchorText,
    pageHintInChapter: loc.pageHintInChapter,
  });
  p?.catch(() => {});
  return;
}

// fallback: percentage/page

PATCH 6 — routes.ts: хранение locator в reading_progress.settings._progress

Файл: routes.ts (endpoint updateProgress)
Идея: не затирать settings, только вложить _progress.

Псевдопатч:

const { locator, ...rest } = req.body;

const existing = await db.select().from(reading_progress).where(...).limit(1);
const settings = existing?.settings ?? {};

const newSettings = {
  ...settings,
  _progress: locator ?? settings._progress,
};

await db.update(reading_progress)
  .set({
    // другие поля прогресса (если есть)
    settings: newSettings,
    updated_at: new Date(),
  })
  .where(...);

Что Qoder должен проверить (мини-acceptance)

Открыл → ушёл в середину → refresh → тот же абзац

Поменял ширину/ориентацию → refresh → тот же абзац

Поменял fontSize/margins → refresh → тот же абзац

EPUB со списками/цитатами → стабильное восстановление

Если хочешь, я могу следующим сообщением сделать ещё более “в лоб”:
PR-структуру на 6–8 коммитов с названиями (чтобы Qoder строго по шагам вливал и не ломал сборку).