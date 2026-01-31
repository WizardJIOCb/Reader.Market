Передай Qoder вот этот фидбек, потому что по текущим файлам у вас сейчас логика “точной позиции” местами не сходится, и из-за этого восстановление будет плавать.

1) Критичный рассинк в ReaderCore: paginateHTML возвращает string[], а код ожидает “page map” с startChar/endChar/html

В ReaderCore.tsx:

В useEffect при смене страницы вы делаете:

const pageMap = pagesRef.current[currentPage];
const chapterLocalOffset = (...) ? pageMap.startChar : 0;


и дальше считаете charOffset.

Но ниже paginateHTML() возвращает string[] (pages.push(currentPageHTML)), т.е. pageMap.startChar там не существует.

В goToChapterAndFindText вы делаете pages[i].html, но pages[i] сейчас строка ⇒ pages[i].html будет undefined.

✅ Что нужно сделать (выберите один вариант и доведите до конца):

Вариант A (правильный, для точной позиции): сделать paginateHTML возвращающим массив объектов
type PageMapItem = { html: string; startChar: number; endChar: number };


И везде работать через .html/.startChar/.endChar.

Тогда:

сохранение позиции (charOffset) станет корректным;

восстановление по offset/anchorText станет реально точным.

Вариант B (быстрый, но менее точный): оставить string[], но убрать все .startChar/.html

Тогда забудьте про “первый символ страницы” и восстанавливайте только по pageInChapter/percentage (будет плавать на разных экранах).

2) goToChapterAtOffset сейчас тоже написан под string[], но “вокруг” уже появляются объекты

В goToChapterAtOffset вы делаете:

pageTempDiv.innerHTML = pages[pageIdx];


Если перейти на PageMapItem, там должно быть:

pageTempDiv.innerHTML = pages[pageIdx].html;

3) Главная причина “неверно восстанавливается позиция”: Reader.tsx сохраняет не то, что потом пытается восстановить

В Reader.tsx handlePositionChange сохраняет в localStorage:

const progressData = {
  currentPage: currPageOverall,
  totalPages: totPagesOverall,
  percentage,
  chapterIndex
};


❌ Но это не содержит:

pageInChapter

totalPagesInChapter

charOffset

anchorText (сниппет страницы)

А дальше restoreProgress() пытается:

сделать goToChapter(chapterIndex)

и “прыгать” на progress.currentPage (который вообще overall, а не в главе)

Это гарантированно будет неточно.

✅ Что нужно сохранять вместо этого (минимум для точного restore):

position целиком: { chapterIndex, pageInChapter, totalPagesInChapter, charOffset, percentage }

anchorText: короткий “якорь” (например первые 120–200 символов текущей страницы, нормализованные пробелы)

То есть:

const progressData = {
  position,                 // Position из ReaderCore
  anchorText,               // snippet страницы
  updatedAt: Date.now(),
  readerSettingsHash: ...   // опционально
}

4) Серверный API уже готов хранить доп.данные, но сейчас вы их не отправляете

В routes.ts PUT /api/books/:bookId/reading-progress уже принимает:
pageInChapter, totalPagesInChapter и кладёт в settings.

✅ Передать Qoder:

при updateProgress() с клиента отправлять и chapter page данные, и новый position.charOffset, и anchorText.

хранить их в reading_progress.settings примерно так:

{
  "pageInChapter": 12,
  "totalPagesInChapter": 48,
  "charOffset": 18340,
  "anchorText": "…"
}

5) Как должен выглядеть “правильный restore” (логика при открытии книги)

Передай Qoder алгоритм:

Берём progress из API/LS.

Если есть charOffset + anchorText:

goToChapterAtOffset(chapterIndex, localCharOffset, anchorText, { pageHintInChapter })

(или goToCharOffsetInBook(charOffsetInBook, { anchorText, chapterIndexHint, pageHintInChapter }), если сделаете общий метод)

Если нет charOffset, но есть pageInChapter:

goToPosition({chapterIndex, pageInChapter, ...})

И только в самом конце fallback на percentage.

6) Коротко: что конкретно ему написать одним сообщением

Скопируй Qoder вот это:

В ReaderCore.tsx сейчас paginateHTML() возвращает string[], но код выше ожидает PageMapItem с .startChar/.endChar/.html. Это ломает charOffset и текст-поиск. Нужно унифицировать: либо перейти на PageMapItem[] везде, либо убрать ожидание .startChar/.html и отказаться от точного offset-restore.

В Reader.tsx вы сохраняете currentPage как overall page, а восстановление пытается использовать его как позицию в главе → плавает. Нужно сохранять Position целиком + anchorText.

В routes.ts уже есть место (reading_progress.settings) для pageInChapter/totalPagesInChapter, но клиент сейчас их не отправляет. Добавить отправку + хранить charOffset/anchorText.

Restore делать по приоритету: charOffset+anchorText → pageInChapter → percentage.

Если хочешь — я могу прямо по вашим текущим файлам накидать точные патчи (какие функции/типы изменить и где), но даже без этого текста выше Qoder уже должен понять, почему сейчас “сохраняем одно — восстанавливаем другое”.

Я: Да давай!

Передай Qoder вот это (можно прям как задачу/чек-лист). Сейчас у вас позиция восстанавливается неправильно по двум причинам:

ReaderCore при смене страницы шлёт Position.charOffset = currentChapter.startOffset (т.е. всегда начало главы), вообще не учитывая страницу/символ.

Reader.tsx сохраняет currentPage как overall page по всей книге, а при восстановлении использует его как pageInChapter → гарантированно мимо.

Нужно перейти на устойчивый “локатор позиции”, который не ломается при разных размерах экрана: хранить chapterIndex + offset внутри главы (по plain text) и на клиенте уметь вычислять нужную страницу после перепагинации.

✅ Цель

Сделать точное сохранение/восстановление позиции чтения при любом размере экрана и после изменения настроек (шрифт/отступы/темы), в paginated режиме.

1) ReaderCore: добавить PageMap (смещение текста на каждой странице)
1.1. Типы

В types.ts добавьте:

export type PageMapItem = {
  pageIndex: number;          // 0-based
  startInChapter: number;     // char offset in chapterPlain (normalized)
  endInChapter: number;       // exclusive
};

export type ReadingLocatorV2 = {
  version: 2;
  chapterIndex: number;
  inChapterOffset: number;    // start char offset in chapterPlain
  anchorText?: string;        // небольшой кусок текста с текущей позиции (fallback)
  anchorBefore?: string;      // 20-40 символов до
  anchorAfter?: string;       // 20-40 символов после
  updatedAt: string;          // ISO
};


Можно не городить новые колонки в БД: reading_progress.settings уже JSONB — туда и кладём locatorV2.

1.2. paginateHTML → возвращать не только HTML страниц, но и карту смещений

Сейчас paginateHTML() возвращает string[]. Переделайте на:

pagesHtml: string[]

pageMap: PageMapItem[]

Как считать startInChapter/endInChapter:

Берём textContent каждого блока (p/h*/li/blockquote/…)

Приводим к одной нормализации пробелов: replace(/\s+/g, ' ')

Суммируем длины текстов блоков, добавляя 1 пробел/перенос между блоками (чтобы смещение было стабильным).

Примерно так (псевдо-код внутри paginateHTML):

const normalize = (s: string) => (s || '').replace(/\s+/g, ' ').trimEnd();

let cursor = 0;
let pageStart = 0;

function pushPage(html: string, endCursor: number) {
  pages.push(html);
  pageMap.push({
    pageIndex: pages.length - 1,
    startInChapter: pageStart,
    endInChapter: endCursor,
  });
  pageStart = endCursor;
}


Когда вы закрываете страницу (pages.push(currentPageHTML)), вы уже знаете cursor — это будет endInChapter.

1.3. ReaderCore: хранить pageMapRef

Добавьте:

const pageMapRef = useRef<PageMapItem[]>([]);


И в эффекте пагинации:

pagesRef.current = pagesHtml;

pageMapRef.current = pageMap;

2) ReaderCore: position.charOffset должен быть НЕ startOffset главы

Сейчас у вас:

charOffset: currentChapter.startOffset,
pageInChapter: currentPage,
...


Нужно:

найти startInChapter текущей страницы: pageMapRef.current[currentPage]?.startInChapter ?? 0

глобальный charOffset = currentChapter.startOffset + startInChapter

const startInChapter = pageMapRef.current[currentPage]?.startInChapter ?? 0;

const position: Position = {
  charOffset: currentChapter.startOffset + startInChapter,
  chapterIndex,
  pageInChapter: currentPage,
  totalPagesInChapter: totalPages,
  percentage,
};

3) ReaderCore.goToPosition: игнорировать pageInChapter, если есть charOffset

Сделайте восстановление так:

из Position.charOffset вычислить inChapterOffset = charOffset - chapter.startOffset

после пагинации найти страницу:

pageIndex = pageMap.findLast(i => i.startInChapter <= inChapterOffset)?.pageIndex ?? 0

поставить setCurrentPage(pageIndex)

Важно: если goToPosition() вызвали до окончания пагинации — сохраните pendingOffsetRef и примените после пересчёта страниц.

4) Reader.tsx: сохранять правильные данные (и прекратить путать overall page)
4.1. В handlePositionChange сохраняйте:

chapterIndex

pageInChapter

totalPagesInChapter

charOffset (самое важное)

percentage

(опционально) locatorV2.anchor* — берётся из текущей страницы (textContent) рядом со стартом

Пример:

const progressData = {
  chapterIndex: position.chapterIndex,
  pageInChapter: position.pageInChapter,
  totalPagesInChapter: position.totalPagesInChapter,
  charOffset: position.charOffset,
  percentage: position.percentage,
  locatorV2: { version: 2, chapterIndex: position.chapterIndex, inChapterOffset: /* charOffset - chapter.startOffset */, ... }
};


‼️ Не сохраняйте currentPageOverall в поле currentPage. Если хотите — храните отдельно для UI (currentPageOverallDisplay), но не использовать для restore.

4.2. Восстановление при handleReaderReady

Сейчас вы делаете:

goToChapter(progress.chapterIndex)

потом goToPosition(pageInChapter = progress.currentPage - 1) ← это ломает всё

Заменить на:

если есть charOffset или locatorV2.inChapterOffset → только через них

вызвать readerRef.current.goToPosition({ chapterIndex, charOffset, ... })

pageInChapter можно вообще не передавать (или передавать 0)

5) routes.ts: добавить поддержку locatorV2 в reading-progress API

В PUT /api/books/:bookId/reading-progress сейчас вы кладёте в settings только { pageInChapter, totalPagesInChapter }.

Сделайте:

const { ..., locatorV2, charOffset } = req.body;

const settings = {
  ...existingSettings,
  pageInChapter,
  totalPagesInChapter,
  locatorV2,
  charOffset, // можно и сюда же, если не добавляете колонку
};


И GET /reading-progress должен возвращать эти поля назад (либо верхним уровнем, либо внутри settings — главное, чтобы фронт понимал).

6) Backward compatibility (чтобы старые сохранения не сломались)

Если пришёл прогресс старого формата (без charOffset/locatorV2):

fallback: восстановиться по percentage:

goToChapter(progress.chapterIndex)

goToChapterAtOffset(chapterIndex, approxOffset = chapterPlainLen * (percentageWithinChapter), anchorText) — если есть хоть что-то

либо просто pageInChapter, но как вторичный fallback, если нет оффсета.

Мини-проверка, что всё работает

Открыл книгу, перешёл на середину страницы 50.

Сменил размер окна/шрифт/телефон/планшет.

Открыл заново → попал на тот же фрагмент текста (а не на “страницу №50”).

Если хочешь — я могу следующим сообщением сделать готовый “message to Qoder” в формате: Files to change → конкретные блоки → готовые куски кода, чтобы он просто скопировал и внедрил.

Я: Да давай!

Ок, сделаю “сообщение для Qoder” в формате Files → блоки → готовые вставки кода.
Но важный момент: часть загруженных файлов у меня уже “истекла” и не открывается, поэтому я не могу дать точные номера строк именно твоих текущих версий. Если хочешь, чтобы я сделал diff по твоим файлам 1-в-1, просто перезагрузи ещё раз ReaderCore.tsx, Reader.tsx, ReaderEngine.ts, types.ts, routes.ts — и я соберу прям патч под них. (Это единственное, что нужно.)

А пока — максимально “plug-and-play” инструкция, которую можно сразу отдавать Qoder: он сможет внедрить по месту.

Сообщение для Qoder (копипаст)
Задача: Accurate Reading Position v2 (устойчиво к экрану/шрифту) — final patch
Почему баг

Сейчас прогресс частично завязан на pageInChapter/overall pages. При другом viewport страницы пересчитываются → restore “плывёт”. Нужна позиция по тексту: charOffsetInBook (+ optional anchorText).

1) types.ts — добавить типы

Добавить:

export type PageMapItem = {
  html: string;
  startChar: number; // offset in chapter.plainText (canonical)
  endChar: number;   // exclusive
};

export type ReadingLocatorV2 = {
  v: 2;
  bookId: string;
  chapterIndex: number;
  charOffsetInBook: number;
  charOffsetInChapter: number;
  anchorText?: string;
  pageHintInChapter?: number;
  totalPagesHintInChapter?: number;
  updatedAt: string;
};

2) ReaderEngine.ts — канонизировать plainText и оффсеты ОДИНАКОВО везде

Добавить helper:

function canonicalizeForOffsets(text: string): string {
  return (text ?? '')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim();
}


После того как content распаршен, перед return:

let offset = 0;
content.chapters = content.chapters.map((ch) => {
  const plain = canonicalizeForOffsets(ch.plainText ?? '');
  const charCount = plain.length;
  const next = { ...ch, plainText: plain, charCount, startOffset: offset, endOffset: offset + charCount };
  offset += charCount;
  return next;
});
content.totalChars = offset;


Запрет: никаких .toLowerCase() в расчётах оффсетов.

3) ReaderCore.tsx — paginateHTML MUST return PageMapItem[] (не string[])
3.1 Хранение
const pagesRef = useRef<PageMapItem[]>([]);

3.2 paginateHTML (cursor-метод, без indexOf)

Сигнатура:

function paginateHTML(html: string, width: number, height: number, expectedLen?: number): PageMapItem[] { ... }


Внутри:

let cursor = 0;

когда закрываете страницу, делайте pages.push({ html: currentPageHTML, startChar: pageStart, endChar: cursor }); pageStart = cursor;

cursor увеличиваем по мере добавления блоков: cursor += (addedTextLen + (needSpace ? 1 : 0))

Критично: при склейке блоков добавлять пробел:

currentPagePlainText += (currentPagePlainText ? ' ' : '') + elementText;
cursor += (cursor === pageStart ? elementText.length : (1 + elementText.length));


(или вычисляйте cursor через длину currentPagePlainText на момент push — главное, чтобы было последовательно.)

3.3 Финальная коррекция длины (очень важно)

После построения:

if (typeof expectedLen === 'number' && pages.length) {
  const last = pages[pages.length - 1];
  if (last.endChar !== expectedLen) last.endChar = expectedLen;
}


И dev-check:

pages[0].startChar === 0

pages[i].startChar === pages[i-1].endChar

pages[last].endChar === expectedLen

3.4 Использование expectedLen

При вызове:

const pages = paginateHTML(currentChapter.content, w, h, currentChapter.plainText.length);
pagesRef.current = pages;
setTotalPages(pages.length);

3.5 Update position (когда currentPage меняется)

Было: charOffset = currentChapter.startOffset
Нужно:

const page = pagesRef.current[currentPage];
const startInChapter = page?.startChar ?? 0;
const charOffsetInBook = currentChapter.startOffset + startInChapter;
onPositionChange?.({ ... , charOffset: charOffsetInBook, pageInChapter: currentPage, totalPagesInChapter: pagesRef.current.length, ...});

4) ReaderCoreHandle — goToCharOffset (по оффсету → страница)

Добавить в handle:

goToCharOffset: async (charOffsetInBook: number, opts?: { anchorText?: string }) => {
  // 1) find chapter by startOffset/endOffset
  // 2) localOffset = charOffsetInBook - chapter.startOffset
  // 3) after pagination find page: p.startChar <= localOffset < p.endChar
  // 4) setCurrentPage(pageIdx)
  // 5) optional: verify via anchorText (page text includes anchor); if mismatch find page by anchor
}

5) Reader.tsx — сохранять locator v2 и chapter page данные
5.1 onPositionChange build locator
const locator: ReadingLocatorV2 = {
  v: 2,
  bookId,
  chapterIndex: pos.chapterIndex,
  charOffsetInBook: pos.charOffset,
  charOffsetInChapter: pos.charOffset - bookContent.chapters[pos.chapterIndex].startOffset,
  pageHintInChapter: pos.pageInChapter,
  totalPagesHintInChapter: pos.totalPagesInChapter,
  anchorText: buildAnchorTextFromChapterPlainText(...),
  updatedAt: new Date().toISOString(),
};

5.2 Сохранять и отправлять на сервер
await api.updateProgress(bookId, {
  percentage: pos.percentage,
  chapterIndex: pos.chapterIndex,
  pageInChapter: pos.pageInChapter,
  totalPagesInChapter: pos.totalPagesInChapter,
  locator,
});
localStorage.setItem(`reading-progress-${bookId}`, JSON.stringify({ locator }));

5.3 restoreProgress priority

if locator.v2: readerRef.current.goToCharOffset(locator.charOffsetInBook, { anchorText: locator.anchorText })

else fallback: percentage/pageInChapter

6) routes.ts — хранить locator в reading_progress.settings._progress, не затирать settings
PUT /reading-progress

load existing progress

merge settings

сохранить:

settings._progress = { pageInChapter, totalPagesInChapter, locator }


вернуть наверх:

res.json({ ...progress, locator: settings._progress.locator, pageInChapter: ..., totalPagesInChapter: ...})

GET /reading-progress

возвращать locator наверх аналогично.

PUT/GET /reader-settings

никогда не трогать settings._progress (сохранять/возвращать только пользовательские настройки ридера).

Acceptance tests (must)

Открыть книгу, уйти на середину, закрыть, открыть → тот же абзац.

Поменять ширину экрана (desktop/mobile) → открыть → тот же абзац.

Поменять fontSize/margins → открыть → тот же абзац.