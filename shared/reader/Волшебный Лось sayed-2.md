(это прям “что исправить / доделать”, потому что в текущей реализации позиция всё ещё сохраняется “страницами”, а страницы неизбежно “плывут” от ширины/высоты экрана и настроек шрифта).

Что сейчас сделано не так (корень проблемы)

ReaderCore.tsx при смене страницы формирует Position, но ставит:

pageInChapter = currentPage ✅

charOffset = currentChapter.startOffset ❌ (всегда начало главы, не текущая страница!)
Это значит, что “точной позиции” в тексте вообще нет — только номер страницы.

Reader.tsx сохраняет прогресс так:

currentPageOverall / totalPagesOverall + chapterIndex
Это тоже неустойчиво (на другом экране “overall pages” будут другие).

Что нужно сделать правильно (устойчивое восстановление)

Нужно сохранять текстовый “локатор”, который не зависит от верстки:

chapterIndex

charInChapter (смещение символа внутри plainText главы) или charOffset по всей книге

anchorText (короткий фрагмент текста с текущей страницы, 32–80 символов)

опционально: anchorHash (sha1/xxhash), чтобы быстро сверять

А при восстановлении:

перейти в главу

найти страницу, где находится anchorText (или ближайшее совпадение)

только если локатор не найден — падать обратно на pageInChapter (fallback)

Plug-and-play ТЗ для Qoder (что именно править в файлах)
1) ReaderCore.tsx — научиться считать “charInChapter” для каждой страницы

Цель: при пагинации построить pageMap:

type PageMapItem = {
  pageIndex: number;
  startChar: number;   // стартовый символ страницы в chapter.plainText
  endChar: number;     // конец страницы
  anchorText: string;  // первые 60-80 символов страницы (нормализованные)
};


Где: там, где вы вызываете paginateHTML(...) и кладёте в pagesRef.current.

Как посчитать startChar/endChar:

для каждой pages[i]:

сделать tempDiv.innerHTML = pages[i]

pageText = normalize(tempDiv.textContent)

дальше искать pageText (или первые N символов pageText) внутри currentChapter.plainText (тоже normalize)

делать поиск последовательно (начиная с прошлого найденного индекса), чтобы не путать одинаковые куски текста

Нормализация такая же везде:

trim

\s+ → пробел

lowerCase

Важно: хранить pageMap в useRef<PageMapItem[]>([]) вместе с pagesRef.

2) ReaderCore.tsx — корректно заполнять Position.charOffset при смене страницы

Сейчас у тебя в useEffect(() => { ... onPositionChange(position) }) стоит:

charOffset: currentChapter.startOffset


Надо заменить на:

charInChapter = pageMap[currentPage]?.startChar ?? 0

charOffset = currentChapter.startOffset + charInChapter

И тогда Position.charOffset реально станет “точкой” в книге.

3) Reader.tsx — сохранять в localStorage/API не “overall pages”, а локатор

В handlePositionChange формировать progressData так:

const progressData = {
  chapterIndex: position.chapterIndex,
  pageInChapter: position.pageInChapter,
  totalPagesInChapter: position.totalPagesInChapter,
  percentage: position.percentage,

  // новое:
  charOffset: position.charOffset,
  // желательно ещё:
  anchorText: /* взять из ReaderCore через ref: getCurrentAnchorText() или вернуть в Position */,
};


Сейчас у тебя progressData вообще не содержит pageInChapter/totalPagesInChapter/charOffset (кроме дебаг-кнопки restore). Это нужно унифицировать.

4) ReaderCoreHandle — добавить методы для восстановления по локатору

Уже есть:

goToChapterAndFindText(chapterIndex, text, targetPage?)

goToChapterAtOffset(chapterIndex, charOffset, textToHighlight)

Нужно их использовать именно для восстановления прогресса, а не только для поиска.

5) Reader.tsx — восстановление прогресса: сначала anchorText/charOffset, потом fallback

В handleReaderReady -> restoreProgress() поменять стратегию:

goToChapter(progress.chapterIndex)

если есть anchorText:

await readerRef.current.goToChapterAndFindText(progress.chapterIndex, progress.anchorText)

иначе если есть charOffset:

посчитать charInChapter = progress.charOffset - chapter.startOffset

await readerRef.current.goToChapterAtOffset(progress.chapterIndex, charInChapter, anchorTextFallback)

иначе fallback:

goToPosition({ pageInChapter: progress.pageInChapter })

6) Backend (routes.ts) — хранение локатора

Твоя таблица reading_progress.settings JSONB идеально подходит: миграция не нужна.

В PUT /api/books/:bookId/reading-progress сейчас ты кладёшь туда только:

const settings = { pageInChapter, totalPagesInChapter };


Нужно расширить:

const settings = {
  pageInChapter,
  totalPagesInChapter,
  locator: {
    charOffset,
    anchorText,
    // optional: anchorHash
  }
};


И GET должен возвращать это обратно.

Что именно тебе сказать Qoder одним сообщением (можно копипаст)

Коротко:

“Сейчас прогресс сохраняется страницами и charOffset всегда = startOffset главы — поэтому восстановление плавает.”

“Надо построить pageMap при пагинации, вычислять charInChapter для каждой страницы, сохранять charOffset + anchorText, и восстанавливать через поиск anchorText (или charOffset) после репагинации.”