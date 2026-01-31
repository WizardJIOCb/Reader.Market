Да, эти “последние” файлы уже выглядят как то, что Qoder описывает — я проверил ReaderCore.tsx и ReaderEngine.ts из новых загрузок.

Что сейчас сделано правильно (и это прям закрывает основные баги)
ReaderCore.tsx

✅ pagesRef теперь useRef<PageMapItem[]>([]) (а не string[]).

✅ Рендер берёт pagesRef.current[currentPage]?.html — корректно.

✅ paginateHTML() реально строит PageMapItem[] со startChar/endChar.

✅ Есть boundary-fix на разрыве страницы:

добавляет пробел только если нужен (!endsWith(' '))

синхронизирует lastPage.text, lastPage.endChar, cursor

✅ Есть финальная коррекция длины через needLen = Math.max(0, ...) и pad/slice, плюс cursor = expectedLen.

✅ Валидации на:

последовательность диапазонов (без дыр)

инвариант (end-start) === text.length

покрытие last.endChar === expectedLen

ReaderEngine.ts

✅ EPUB теперь делает плотный индекс через chapterIdx++ (а не spine i).

✅ canonicalizeOffsets() принудительно ставит index: i и пересчитывает startOffset/endOffset последовательно.

✅ parseEPUBChapter() считает text из cleaned HTML через extractStructuredText(html) / canonicalizeForOffsets.

Это всё вместе как раз и даёт “железобетон” для восстановления позиции после:

refresh

смены ширины/ориентации

смены font/lineHeight/margins

сложного EPUB

2 мелких улучшения (не блокеры, но стоит сделать)

Канонизировать в pushPage на всякий случай
Сейчас pushPage кладёт text как передали (а вы почти везде уже передаёте canonical). Чтобы никогда не поймать “кто-то передал не то”, можно сделать:

const canon = canonicalizeForOffsets(text);
const startChar = cursor;
const endChar = cursor + canon.length;
pages.push({ html, text: canon, startChar, endChar });
cursor = endChar;


Логи в dev-коррекции
В dev-коррекции у вас сообщение “clamped from … to …” печатается уже после cursor = expectedLen — косметика, но можно поправить, чтобы лог был честный.

Что можно ответить Qoder (готово к копипасте)

Посмотрел актуальные ReaderCore.tsx и ReaderEngine.ts — теперь всё соответствует финальному ТЗ: pagesRef = PageMapItem[], paginateHTML с boundary spacing + duplicate-prevention + text/offset sync, expectedLen коррекция через pad/slice, EPUB dense chapterIdx++ и canonicalizeOffsets с index=i и пересчётом offsets, parseEPUBChapter text берётся из cleaned HTML через extractStructuredText. Можно (опционально) канонизировать text прямо в pushPage для дополнительной страховки.

Если хочешь — скинь ещё Reader.tsx, я одним взглядом проверю, что restore-вызовы сделаны безопасно (без readerRef.current?.method().catch(...)), и что сохранение locator v2 на бэк у вас не затирает reader settings.

Reader.tsx
TypeScript
Думал на протяжении 1m 52s

Посмотрел актуальный Reader.tsx — в целом он теперь согласован с вашей “железобетонной” схемой (locator v2 + goToCharOffset).

Что хорошо и “правильно сделано”

✅ Приоритет восстановления: сначала locator v2 → goToCharOffset(...), потом fallback (pageInChapter / percentage).

✅ Безопасный async: ты уже используешь правильный паттерн:

const p = readerRef.current?.goToCharOffset(...);
p?.catch(() => {});


(а не readerRef.current?.method().catch()).

✅ Сохранение locator v2 в handlePositionChange: пишешь в localStorage и шлёшь в API с debounce.

✅ На unload/unmount есть “best effort” сохранение (keepalive fetch + readerApi.updateProgress).

2 вещи, которые я бы уточнил/улучшил (не критично, но важно проверить)
1) charOffsetInBook = position.charOffset — это верно только если position.charOffset уже глобальный оффсет по книге

Сейчас у тебя:

const chapterStartOffset = bookContent?.chapters?.[position.chapterIndex]?.startOffset ?? 0;
const charOffsetInBook = position.charOffset;
const charOffsetInChapter = Math.max(0, charOffsetInBook - chapterStartOffset);


Это корректно, если ReaderCore кладёт в Position.charOffset именно charOffsetInBook (глобальный). Судя по вашим прошлым фиксам — скорее всего так и есть.

👉 Но чтобы исключить риск навсегда, я бы попросил Qoder сделать одно из двух:

либо переименовать поле в Position (например charOffsetInBook) чтобы не было двусмысленности,

либо (быстрый safety) добавить runtime-check в dev:

если position.charOffset < chapterStartOffset, значит оффсет может быть локальным, и надо считать:

const charOffsetInBook = chapterStartOffset + position.charOffset;

2) В legacy fallback ты читаешь progress.charOffset, но ты его уже не сохраняешь

В progressData ты не кладёшь charOffset, поэтому тут:

charOffset: progress.charOffset || 0,


почти всегда будет 0. Это не ломает fallback (goToPosition всё равно опирается на page/percentage), но лучше либо:

убрать progress.charOffset из fallback совсем,

либо класть charOffsetInBook в progressData для диагностики.

Что можно передать Qoder одним сообщением

Reader.tsx ок: locator v2 restore через goToCharOffset + p?.catch, сохранение locator в localStorage+API. Проверь/зафиксируй семантику Position.charOffset: это должен быть глобальный charOffsetInBook. Для исключения двусмысленности лучше переименовать/добавить dev-check. И в legacy fallback либо убери progress.charOffset, либо сохраняй charOffsetInBook в progressData.

Если хочешь — кинь ещё components/reader/types.ts (где описан Position), я скажу точно, глобальный ли там charOffset по факту, и нужно ли вообще делать этот safety-branch.

types.ts
TypeScript
Думал на протяжении 20s

Посмотрел твой types.ts — там всё однозначно:

✅ Position.charOffset по контракту — глобальный оффсет по книге

В интерфейсе прямо написано:

export interface Position {
  /** Character offset in the book content */
  charOffset: number;
  ...
}


То есть это offset в “book content”, не “в главе”. А локальный оффсет в главе у вас выводится как:

charOffsetInChapter = charOffsetInBook - chapter.startOffset

✅ Значит логика в Reader.tsx корректная

Твой код:

const chapterStartOffset = bookContent?.chapters?.[position.chapterIndex]?.startOffset ?? 0;
const charOffsetInBook = position.charOffset;
const charOffsetInChapter = Math.max(0, charOffsetInBook - chapterStartOffset);


— соответствует контракту types.ts.

Что стоит передать Qoder (чтобы не было двусмысленностей и регрессий)

В ReaderCore/ReaderEngine гарантировать, что onPositionChange(Position) отдаёт:

position.charOffset = locator.charOffsetInBook (глобальный)

position.chapterIndex актуальный

pageInChapter/totalPagesInChapter актуальные для текущей пагинации

(Опционально, но полезно) переименовать поле в Position ради ясности:

charOffset → charOffsetInBook
или хотя бы поправить коммент так, чтобы это было 100% очевидно всем.

Добавить dev-assert (1 строка) в Reader.tsx при расчёте:

если position.charOffset < chapter.startOffset, логнуть warn (это бы означало, что кто-то случайно начал отдавать локальный оффсет).

Если хочешь — я могу подсказать точное место в ReaderCore.tsx, где лучше всего формировать Position.charOffset из ReadingLocatorV2.charOffsetInBook, чтобы исключить любые расхождения.

Да давай
Думал на протяжении 10s

Да — лучше всего формировать Position.charOffset прямо в ReaderCore.tsx в одном месте, где у тебя уже есть:

currentChapter.startOffset

pagesRef.current (PageMapItem[])

currentPage

Тогда Reader.tsx всегда будет получать глобальный оффсет по книге (как в types.ts), и двусмысленностей не будет.

Важное: часть файлов, которые ты загружал ранее, у меня сейчас “истекла” (в песочнице). Поэтому точные номера строк я не назову. Но ниже — plug-and-play патч, который Qoder сможет вставить в ReaderCore.tsx по поиску onPositionChange / handlePositionChange / setCurrentPage.

Патч: единая функция emitPosition() в ReaderCore
1) Добавить helper (внутри компонента ReaderCore, рядом с остальными callbacks)
const emitPosition = useCallback(() => {
  if (!content || !currentChapter) return;

  const pages = pagesRef.current;
  const pageItem = pages?.[currentPage];

  const pageStartInChapter = pageItem?.startChar ?? 0; // char offset within chapter.plainText
  const charOffsetInBook = (currentChapter.startOffset ?? 0) + pageStartInChapter;

  const pos: Position = {
    chapterIndex: currentChapter.index, // важно: плотный индекс
    pageInChapter: currentPage,
    totalPagesInChapter: pages?.length ?? 0,
    charOffset: charOffsetInBook, // ГЛОБАЛЬНЫЙ оффсет по книге
    percentage:
      content.totalChars && content.totalChars > 0
        ? (charOffsetInBook / content.totalChars) * 100
        : 0,
  };

  onPositionChange?.(pos);
}, [content, currentChapter, currentPage, onPositionChange]);

2) Вызывать emitPosition() там, где позиция реально меняется

Минимально достаточно вызвать в 3 местах:

после успешной пагинации / после setCurrentPage(...)

после setCurrentChapter(...)

после goToCharOffset(...) (когда вы нашли нужную страницу)

Пример (сразу после смены страницы):

setCurrentPage(nextPage);
requestAnimationFrame(() => emitPosition());


И после установки главы:

setCurrentChapter(ch);
setCurrentPage(0);
requestAnimationFrame(() => emitPosition());

3) В goToCharOffset(...) после нахождения страницы

Когда вы вычислили targetPageIndex, сделайте:

setCurrentChapter(chapter);
setCurrentPage(targetPageIndex);
requestAnimationFrame(() => emitPosition());

Почему именно так

PageMapItem.startChar — локальный оффсет в пределах chapter.plainText

chapter.startOffset — глобальный оффсет начала главы в книге

сумма даёт charOffsetInBook, что идеально совпадает с контрактом types.ts.

Сообщение для Qoder (можно копипастой)

В ReaderCore сделайте единый emitPosition() и всегда отдавайте Position.charOffset = currentChapter.startOffset + pagesRef.current[currentPage].startChar (глобальный оффсет по книге). Вызывать emitPosition после смены страницы/главы и после goToCharOffset. Это гарантирует, что Reader.tsx всегда получает глобальный offset и правильно вычисляет charOffsetInChapter.