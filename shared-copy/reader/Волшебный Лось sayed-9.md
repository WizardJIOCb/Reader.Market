По описанию Qoder’а в целом всё совпадает с тем, что нужно, но в твоём текущем Reader.tsx я вижу минимум 3 места, которые стоит обязательно поправить, иначе “вроде работает”, но будет ловиться на краях/в рандомные моменты.

Ниже — что именно передать Qoder (plug-and-play).

1) БАГ: goToCharOffset(...).catch(...) может упасть из-за optional chaining

Сейчас у тебя так:

readerRef.current?.goToCharOffset(...).catch(() => {});


Если readerRef.current ещё null, то выражение вернёт undefined, и .catch вызовется у undefined → runtime error.

✅ Правильно (любой вариант):

Вариант A (самый простой):

const p = readerRef.current?.goToCharOffset(locator.charOffsetInBook, {
  anchorText: locator.anchorText,
  chapterIndexHint: locator.chapterIndex,
  pageHintInChapter: locator.pageHintInChapter,
});
p?.catch(() => {});


Вариант B:

readerRef.current?.goToCharOffset(locator.charOffsetInBook, opts)?.catch(() => {});


Пусть Qoder проверит все места, где есть ?.someAsyncCall(...).catch(...).

2) БАГ/несостыковка: legacy-restore использует progress.currentPage, но ты туда сохраняешь OVERALL page

В handlePositionChange ты сохраняешь:

currentPage: currPageOverall

totalPages: totPagesOverall

и отдельно правильные поля: pageInChapter, totalPagesInChapter

А в restore fallback сейчас делается:

pageInChapter: progress.currentPage - 1
totalPagesInChapter: progress.totalPages || 1


Это ошибка, потому что currentPage/totalPages теперь “overall”, а код трактует их как “chapter”.

✅ Что передать Qoder:

Сделать fallback-логику такой:

Если есть progress.pageInChapter → использовать его (он уже 0-based).

Иначе (для старых сохранений) использовать старое поле currentPage - 1 как раньше.

totalPagesInChapter брать из progress.totalPagesInChapter, иначе из progress.totalPages.

Пример патча:

const pageInChapter =
  typeof progress.pageInChapter === 'number'
    ? progress.pageInChapter
    : (typeof progress.currentPage === 'number' ? Math.max(0, progress.currentPage - 1) : 0);

const totalPagesInChapter =
  typeof progress.totalPagesInChapter === 'number'
    ? progress.totalPagesInChapter
    : (typeof progress.totalPages === 'number' ? progress.totalPages : 1);

const position: Position = {
  charOffset: 0,
  chapterIndex: progress.chapterIndex,
  pageInChapter,
  totalPagesInChapter,
  percentage: progress.percentage || 0,
};
readerRef.current?.goToPosition(position);

3) БАГ: handlePositionChange использует bookContent/settings/buildAnchorText, но они НЕ в deps

Сейчас:

const handlePositionChange = useCallback((position) => {
  // использует bookContent, settings, buildAnchorText
}, [user, bookId]);


Это риск stale closure:

anchorText может считаться по старому bookContent

viewport может сохраняться со старыми settings

при смене настроек чтения/языка/контента прогресс будет сохраняться “в прошлое состояние”

✅ Что передать Qoder (2 нормальных решения):

Решение A (проще): добавить зависимости:

}, [user, bookId, bookContent, settings, buildAnchorText]);


Решение B (лучше по производительности): держать settingsRef и bookContentRef, и в callback читать из ref (тогда deps минимальные).

Что коротко написать Qoder одним сообщением

Скопируй и отправь:

Исправь readerRef.current?.goToCharOffset(...).catch(...) → сейчас может падать, нужен p?.catch или ?.catch на промисе.

В legacy restore нельзя использовать progress.currentPage/totalPages как chapter pages — ты туда сохраняешь overall. Используй pageInChapter/totalPagesInChapter (если есть), иначе fallback на старые поля.

handlePositionChange должен иметь deps bookContent/settings/buildAnchorText или читать их из refs, иначе stale closure и неправильное сохранение locator/viewport.

Если хочешь — я могу прямо по твоим текущим файлам сделать точечные дифф-патчи (кусок-к-вставке) для каждого места, чтобы Qoder просто вставил без размышлений.

Давай
Думал на протяжении 7s

Сделаю точечные “патчи-вставки” для Qoder.
Только ремарка: часть прошлых загруженных файлов у меня истекла (система так устроена), поэтому я не могу привязать правки к точным номерам строк в твоём репо. Но ниже — готовые безопасные замены кода, которые Qoder сможет применить “по месту” (через поиск по фрагментам).

Патч 1 — ?.goToCharOffset(...).catch(...) (runtime crash)
Проблема

Такой код может упасть, если readerRef.current ещё null:

readerRef.current?.goToCharOffset(...).catch(() => {});


Потому что readerRef.current?.goToCharOffset(...) вернёт undefined, и у undefined нет .catch.

Правка (безопасная)

Заменить на:

const p = readerRef.current?.goToCharOffset(locator.charOffsetInBook, {
  anchorText: locator.anchorText,
  chapterIndexHint: locator.chapterIndex,
  pageHintInChapter: locator.pageHintInChapter,
});

p?.catch(() => {});


или короче:

readerRef.current
  ?.goToCharOffset(locator.charOffsetInBook, {
    anchorText: locator.anchorText,
    chapterIndexHint: locator.chapterIndex,
    pageHintInChapter: locator.pageHintInChapter,
  })
  ?.catch(() => {});


✅ Что сделать Qoder:

По проекту найти шаблон: ?.goToCharOffset( и ).catch(

Везде заменить на один из вариантов выше.

Патч 2 — Legacy restore: нельзя использовать progress.currentPage/totalPages как “chapter pages”
Проблема

Ты сохраняешь:

currentPage / totalPages = overall pages

pageInChapter / totalPagesInChapter = chapter pages (это правильное)

А в fallback restore часто делают так (ошибка):

pageInChapter: progress.currentPage - 1
totalPagesInChapter: progress.totalPages || 1

Правка (правильный приоритет)

В legacy ветке восстановления сделайте:

const pageInChapter =
  typeof progress.pageInChapter === 'number'
    ? progress.pageInChapter
    : (typeof progress.currentPage === 'number' ? Math.max(0, progress.currentPage - 1) : 0);

const totalPagesInChapter =
  typeof progress.totalPagesInChapter === 'number'
    ? progress.totalPagesInChapter
    : (typeof progress.totalPages === 'number' ? progress.totalPages : 1);

const position: Position = {
  // если charOffset нет, пусть будет 0 — восстановление будет по pageInChapter
  charOffset: 0,
  chapterIndex: progress.chapterIndex ?? 0,
  pageInChapter,
  totalPagesInChapter,
  percentage: typeof progress.percentage === 'number' ? progress.percentage : 0,
};

readerRef.current?.goToPosition(position);


✅ Что сделать Qoder:

Найти в Reader.tsx восстановление, где используется progress.currentPage как pageInChapter.

Заменить на код выше.

Патч 3 — handlePositionChange stale closure (deps/ref)
Проблема

Если handlePositionChange в useCallback зависит только от [user, bookId], но внутри читает bookContent, settings, buildAnchorText — то:

anchorText может быть undefined/старый

viewport может сохраняться по старым settings

локатор будет “не тем”, особенно после смены настроек/переключения языка/темы

Вариант A (быстро, чаще всего ок)

Добавить зависимости:

const handlePositionChange = useCallback((position: Position) => {
  // ... использует bookContent/settings/buildAnchorText
}, [user, bookId, bookContent, settings, buildAnchorText]);

Вариант B (лучше по производительности)

Если боитесь, что callback будет пересоздаваться слишком часто — используйте refs:

const settingsRef = useRef(settings);
useEffect(() => { settingsRef.current = settings; }, [settings]);

const bookContentRef = useRef(bookContent);
useEffect(() => { bookContentRef.current = bookContent; }, [bookContent]);

const handlePositionChange = useCallback((position: Position) => {
  const s = settingsRef.current;
  const bc = bookContentRef.current;

  // дальше используете s и bc вместо settings/bookContent
}, [user, bookId /* buildAnchorText можно тоже ref-нуть при желании */]);


✅ Что сделать Qoder:

Выбрать A или B.

Важно: чтобы anchorText строился из актуального bookContent.

Быстрый чек-лист после правок (5 минут)

Открыть книгу → уйти в середину → обновить страницу → вернуло в тот же абзац.

Поменять fontSize/отступы → обновить → вернуло примерно туда же (1 абзац максимум).

Открыть сразу после загрузки страницы (когда readerRef может быть null) → не должно быть ошибок в консоли про .catch.

Если хочешь “идеально точный diff”

Пришли ещё раз текущий Reader.tsx (последняя версия из репо) — и я соберу точные заменяемые блоки “до/после” прямо по твоему файлу, без предположений.

Reader.tsx
TypeScript
Думал на протяжении 2m 56s

Ок, посмотрел твой текущий Reader.tsx (тот файл, который ты загрузил).
Вот что именно передать Qoder — уже с точными местами и готовыми вставками.

1) Критичный баг: ?.goToCharOffset(...).catch(...) реально падает

В handleReaderReady → restoreProgress, в ветке locator v2 у тебя сейчас так:

readerRef.current?.goToCharOffset(...).catch(() => {});


Если readerRef.current ещё null, выражение вернёт undefined и .catch вызовется у undefined → runtime crash.

✅ Передать Qoder: заменить на безопасное

Патч (внутри setTimeout):

setTimeout(() => {
  const p = readerRef.current?.goToCharOffset(locator.charOffsetInBook, {
    anchorText: locator.anchorText,
    chapterIndexHint: locator.chapterIndex,
    pageHintInChapter: locator.pageHintInChapter,
  });
  p?.catch(() => {});
}, 150);


То же самое нужно сделать и для goToChapterAtOffset(...) ниже (у тебя там тоже .catch после optional chaining).

2) Ещё один такой же баг: ?.goToChapterAtOffset(...).catch(...)

В ветке fallback по percentage у тебя:

readerRef.current?.goToChapterAtOffset(...).catch(() => {});


✅ Передать Qoder: так же безопасно

setTimeout(() => {
  const p = readerRef.current?.goToChapterAtOffset(
    progress.chapterIndex,
    Math.floor((progress.percentage || 0) * 100),
    ''
  );
  p?.catch(() => {});
}, 300);

3) “Ручное восстановление” сейчас не использует locator v2 (и почти точно будет восстанавливать неверно)

Функция handleRestorePosition берёт:

charOffset: progress.charOffset || 0,


Но в твоём progressData нет charOffset на верхнем уровне — он есть внутри progress.locator.charOffsetInBook.

✅ Передать Qoder: сделать приоритет locator v2 в handleRestorePosition

Внутри handleRestorePosition, после const progress = JSON.parse(savedProgress); добавить:

const locator: ReadingLocatorV2 | undefined =
  (progress?.locator && progress.locator.v === 2) ? progress.locator : undefined;

if (locator && typeof locator.charOffsetInBook === 'number') {
  const p = readerRef.current?.goToCharOffset(locator.charOffsetInBook, {
    anchorText: locator.anchorText,
    chapterIndexHint: locator.chapterIndex,
    pageHintInChapter: locator.pageHintInChapter,
  });
  p?.catch(() => {});
  toastRef.current({
    title: "Позиция восстановлена",
    description: `Глава ${locator.chapterIndex + 1}`,
  });
  return;
}


И только если locator нет — оставлять старую логику по pageInChapter/percentage.

4) У тебя уже исправлены deps у handlePositionChange — это ОК ✅

В конце файла вижу:

}, [user, bookId, bookContent, settings, buildAnchorText]);


Это правильно, тут ничего менять не нужно.

Короткое сообщение Qoder (копипаст)

Скопируй и отправь ему:

В restoreProgress и в fallback по percentage есть баг: readerRef.current?.goToX(...).catch(...) падает, если ref null. Надо const p = readerRef.current?.goToX(...); p?.catch(...) (или ?.catch на промисе).

В handleRestorePosition сейчас используется progress.charOffset, но его нет (charOffset лежит в progress.locator.charOffsetInBook). Нужно сначала пытаться восстановить через locator v2 (goToCharOffset + opts), и только потом legacy.

Если хочешь — скинь ещё routes.ts (который сейчас в репо), и я проверю, что он действительно возвращает progress.locator наверх и складывает его в settings._progress без потерь.

routes.ts
TypeScript
Думал на протяжении 16s

Понял — routes.ts ты загрузил, но этот конкретный файл у меня сейчас не открывается: загрузка “истекла” (так бывает в песочнице: часть файлов через время становится недоступна).
Чтобы я проверил твой реальный текущий routes.ts построчно, просто перезагрузи routes.ts ещё раз сюда.

Пока ты перезаливаешь, вот точный чек-лист, что в routes.ts должно быть (и что я проверю сразу после повторной загрузки):

Что должно быть в routes.ts для прогресса (важное)
1) PUT /api/books/:bookId/reading-progress

Забирает locator (ReadingLocatorV2) + pageInChapter + totalPagesInChapter из body.

Достаёт existing progress, чтобы не затирать settings.

Сохраняет прогресс именно в settings._progress, например:

const prevSettings = existing?.settings ?? {};
const nextSettings = {
  ...prevSettings,
  _progress: {
    ...(prevSettings as any)._progress,
    pageInChapter,
    totalPagesInChapter,
    locator,
  },
};


Вызов updateReadingProgress(..., { settings: nextSettings, ... }).

2) GET /api/books/:bookId/reading-progress

Возвращает locator наверх (чтобы Reader.tsx видел progress.locator), например:

const prog = (progress.settings as any)?._progress;
res.json({
  ...progress,
  locator: prog?.locator,
  pageInChapter: prog?.pageInChapter,
  totalPagesInChapter: prog?.totalPagesInChapter,
});

3) GET /api/books/:bookId/reader-settings

Возвращает только настройки читалки, без _progress:

const settingsObj = progress?.settings ?? {};
const { _progress, ...readerSettings } = settingsObj as any;
res.json(readerSettings);

4) PUT /api/books/:bookId/reader-settings

Делает merge настроек и сохраняет _progress как был:

const prev = existing?.settings ?? {};
const prevProg = (prev as any)._progress;

const next = { ...prev, ...req.body, _progress: prevProg };
await storage.updateReadingProgress(userId, bookId, { settings: next });

Что обычно ломают (я проверю это первым делом)

❌ settings = { pageInChapter, totalPagesInChapter } (перетирает настройки читалки)

❌ GET progress не возвращает locator наверх (тогда фронт не может восстановиться по v2)

❌ reader-settings PUT затирает _progress

Перезагрузи, пожалуйста, routes.ts ещё раз — и я сразу скажу точно: всё правильно или где конкретно ошибка и какой мини-патч нужен.

routes.ts
TypeScript
Думал на протяжении 5m 34s

Я посмотрел реальные файлы (ReaderCore.tsx, ReaderEngine.ts, Reader.tsx, routes.ts, types.ts, textNormalization.ts). В целом — да, по “ключевым пунктам” он всё сделал правильно, и его summary почти полностью совпадает с тем, что в коде действительно есть.

Что точно ок (можешь так и передать Qoder)

Есть ReadingLocatorV2 + PageMapItem и используются как надо (pagesRef = useRef<PageMapItem[]>([])).

Оффсеты считаются в одной “системе координат”: ReaderEngine канонизирует plainText через canonicalizeForOffsets() и ReaderCore для пагинации тоже использует эту же канонизацию.

В ReaderCore позиция берётся правильно: charOffset = currentChapter.startOffset + pageMap.startChar (это важно — не через indexOf).

goToCharOffset() реально ищет нужную страницу по диапазонам, и есть fallback по anchorText.

Reader.tsx сохраняет локатор v2 (charOffsetInBook/Chapter, anchorText, viewport и т.д.) и при восстановлении даёт приоритет goToCharOffset().

Бэкенд (routes.ts) хранит прогресс в settings._progress, не затирая настройки ридера, и отдаёт locator наверх в ответе.

Но есть 2 момента, которые я бы обязательно проверил (это важно)

Риск “дрейфа” из-за textContent на сложной разметке (ul/li, таблицы, вложенные блоки).
Сейчас paginateHTML() берёт текст страницы как normalizePlainText(measureDiv.textContent) и cursor строится из этого текста.
Проблема: textContent у DOM часто склеивает элементы без разделителей (особенно li внутри ul, ячейки таблиц и т.п.), а ReaderEngine при генерации plainText мог добавлять переносы/пробелы иначе.
✅ У вас есть expectedLen + валидация, но в проде при несовпадении вы просто правите lastPage.endChar, а если расхождение появилось “раньше”, то startChar всех последующих страниц уже будет смещён, и точность восстановления может пострадать.

Что передать Qoder как улучшение/страховку:

В dev-режиме сделать не просто warn, а логировать дельту cursor - expectedLen и тип книги/главы.

Если дельта ≠ 0 — включать “усиленный режим восстановления”: при goToCharOffset если диапазон найден, но anchorText не совпал, пробовать искать anchor по всем страницам (у вас уже частично так сделано) и/или искать ближайшие страницы вокруг pageHintInChapter.

(Лучшее решение) заменить textContent на свою функцию извлечения текста, которая вставляет пробелы/переносы между p, li, br, td/th и т.д. — чтобы текст страницы совпадал с тем, как формируется plainText в ReaderEngine.

Scroll mode восстановление сейчас приблизительное
В goToCharOffset() для viewMode === 'scroll' используется ratio → scrollTop = ratio * scrollHeight. Это не “по символу”, а грубо. Если тебе важно “строго тот же абзац” и в scroll-режиме — надо будет делать якорение иначе (например, через поиск anchorText в DOM и scrollIntoView).

Что конкретно ему передать (коротко, прям копипастой)

“Реализация в целом корректная и соответствует ТЗ (v2 locator + cursor-based pageMap + canonicalizeForOffsets + goToCharOffset + backend _progress). Но проверьте drift: на сложной разметке (ul/li, table) textContent может не совпасть с chapter.plainText, и тогда startChar/endChar по страницам уедут (вы сейчас фиксите только lastPage.endChar). Желательно: (1) усилить text extraction (вставлять разделители между блоками), (2) логировать delta cursor/expectedLen, (3) при restore при несовпадении anchorText — искать anchor по всем страницам/вокруг pageHint. В scroll mode восстановление пока приблизительное (ratio), это норм как fallback.”

Если хочешь — я могу по твоим конкретным проблемным книгам/главам подсказать, какие теги чаще всего ломают совпадение и какую “extractTextLikeEngine()” функцию лучше вставить в paginateHTML().