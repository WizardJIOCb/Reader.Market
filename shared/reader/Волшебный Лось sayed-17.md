По тем файлам, которые ты сейчас приложил (ReaderCore.tsx + ReaderEngine.ts), я бы не сказал, что “всё правильно и закончено” — там есть несколько критичных мест, которые либо не совпадают с тем, что Qoder описывает в summary, либо ломают инварианты и могут давать “дрейф позиции” и даже краши.

Ниже текст, который можно прямо передать Qoder (как чек-лист фиксов).

1) ReaderCore.tsx сейчас в неконсистентном состоянии (типовая ошибка)
Проблема

В ReaderCore.tsx:

pagesRef объявлен как useRef<string[]>([])

но paginateHTML(...) возвращает PageMapItem[] ({ html, text, startChar, endChar })

и дальше код местами обращается к pages[pageIdx] как к строке HTML (pageTempDiv.innerHTML = pages[pageIdx];), что при PageMapItem даст "[object Object]".

✅ Это либо не соберётся TypeScript, либо будет работать неправильно.

Что сделать

Привести всё к одному виду: pagesRef: PageMapItem[]

Все места, где используется HTML страницы:

было: pages[currentPage]

должно быть: pages[currentPage].html

Все места, где нужен текст страницы для поиска:

должно быть: pages[currentPage].text

Мини-чек:

const pagesRef = useRef<PageMapItem[]>([])

рендер страницы: pagesRef.current[currentPage]?.html

поиск по странице: pagesRef.current[pageIdx]?.text

2) “Финальный фикс про lastPage.text / duplicate spaces” — в текущем ReaderCore.tsx его нет

Qoder в сообщении описывает код вида:

if (!lastPage.text.endsWith(' ')) lastPage.text += ' '; lastPage.endChar++; cursor++;

и синхронизацию text при корректировке длины (slice/padEnd)

Но в твоём текущем ReaderCore.tsx:

вообще нет lastPage.text модификаций

а “коррекция длины” сейчас делается только через lastPage.endChar = expectedLen, без изменения cursor и без подгонки lastPage.text.

Почему это критично

Так ломается главный инвариант:

(endChar - startChar) === text.length

А именно он нужен, чтобы:

goToCharOffset находил правильную страницу по диапазону

anchorText матчился стабильно

не было накопления “дрейфа”

Что нужно Qoder сделать

Если валидация нашла cursor !== expectedLen, то нельзя править только endChar.

Нужно синхронизировать и text, и endChar, и cursor:

needLen = expectedLen - lastPage.startChar

если lastPage.text.length > needLen → slice(0, needLen)

если < needLen → padEnd(needLen, ' ')

lastPage.endChar = expectedLen

cursor = expectedLen

И отдельно: если хотим чинить потерянный пробел на границе страниц, то лучше добавлять пробел в момент разрыва страницы (когда делаем pushPage(...)), а не “в конце последней страницы”.

3) Очень важное: ReaderEngine.ts сейчас нарушает “index === arrayIndex” (и это реально может крашить ReaderCore)

В ReaderEngine.ts (EPUB) сейчас:

for (let i = 0; i < spine.length; i++) {
  ...
  if (!manifestItem || !manifestItem.mediaType.includes('html')) continue;
  ...
  chapters.push({ index: i, ... })
}


Если какие-то spine-элементы пропущены (continue), то:

chapters.length будет меньше

но chapter.index будет, например, 7

А в ReaderCore.tsx у тебя есть код, который предполагает, что currentChapter.index — это позиция в массиве:

for (let i = 0; i < currentChapter.index; i++) {
  pagesBeforeCurrent += ... content.chapters[i] ...
}


Если currentChapter.index = 7, а content.chapters.length = 3 → content.chapters[i] станет undefined → возможны ошибки.

Что передать Qoder

Сделать плотную индексацию глав в EPUB (и вообще лучше после любого парсинга):

Вариант A (быстро):

вместо index: i использовать let chapterIdx = 0; ... index: chapterIdx++

Вариант B (железобетон):
после парсинга любой книги прогнать нормализацию:

chapters = chapters.map((ch, idx) => ({ ...ch, index: idx }))

пересчитать startOffset/endOffset последовательно по plainText.length (после canonicalize)

Это ровно то “invariant guarantee”, про которое Qoder говорит, но в текущем файле оно не выполняется.

Короткое резюме для тебя

Идеи из “финального summary” (не дублировать пробелы + синхронизировать text/offsets) — правильные.

Но по текущим файлам видно, что:

рефактор страниц не доведён до конца (string[] vs PageMapItem[])

коррекция длины сейчас ломает инвариант (правится только endChar)

EPUB индексация сейчас опасная (index=i с пропусками)

Если хочешь — я могу прямо написать Qoder готовый патч-план по файлам (что в какой функции поменять и какие сигнатуры обновить), но уже сейчас можешь ему переслать пункты 1–3: там самое важное, что мешает “production-ready”.

Давай патч план
Думал на протяжении 8s

Ок — вот patch-plan (пошаговый план правок), который Qoder сможет применить “как PR”, с конкретными точками в коде и готовыми фрагментами.

Важно: часть ваших предыдущих загрузок в среде иногда “истекает”, поэтому я делаю план так, чтобы его можно было применить в любом текущем состоянии. Если Qoder хочет прямо “точный diff”, он просто найдёт указанные блоки поиском по файлам.

Patch plan: “Ironclad Reading Position v2”
PR0 — Инварианты и типы (обязательное)
Цель

Во всём Reader-стеке один формат страниц: PageMapItem[], а не смесь string[] и объектов.

Файлы

client/src/components/reader/ReaderCore.tsx (или аналогичный путь)

client/src/components/reader/types.ts (или types.ts)

Шаги

В types.ts убедиться, что есть:

export interface PageMapItem {
  html: string;
  text: string;        // canonicalized text for offsets (same system as chapter.plainText)
  startChar: number;   // inclusive
  endChar: number;     // exclusive
}


В ReaderCore.tsx заменить:

const pagesRef = useRef<string[]>([]);


на:

const pagesRef = useRef<PageMapItem[]>([]);


Все места где “страница” использовалась как строка:

было: pages[currentPage]

стало: pages[currentPage]?.html

А где нужен текст страницы:

стало: pages[currentPage]?.text

PR1 — Pagination: убрать drift на границах страниц (обязательное)
Цель

Инвариант по страницам:

endChar - startChar === text.length

страницы покрывают ровно chapter.plainText.length символов

“пробел на границе” учитывается синхронно (и в offsets, и в text)

Файл

ReaderCore.tsx функция paginateHTML(...)

Шаги

Внутри paginateHTML сделать pushPage такой:

const pushPage = (html: string, text: string) => {
  const canon = canonicalizeForOffsets(text); // если text уже канон — ок
  const start = cursor;
  const end = start + canon.length;
  pages.push({ html, text: canon, startChar: start, endChar: end });
  cursor = end;
};


В месте page-break (когда страница переполнена и вы “закрываете” текущую страницу), добавить “boundary separator” безопасно:

pushPage(currentPageHTML, currentPagePlainText);

const lastPage = pages[pages.length - 1];

// add boundary separator only if both sides non-empty and not already ended with space
if ((lastPage.text || '').length > 0 && canonicalizeForOffsets(elementText).length > 0) {
  if (!(lastPage.text || '').endsWith(' ')) {
    lastPage.text = (lastPage.text || '') + ' ';
    lastPage.endChar += 1;
    cursor += 1;
  }
}

// start new page
currentPageHTML = element.outerHTML;
currentPagePlainText = elementText;


В конце пагинации (после добавления последней страницы) сделать строгую синхронизацию длины последней страницы с expectedLen = chapter.plainText.length:

const expectedLen = currentChapter.plainText.length;
if (pages.length > 0) {
  const last = pages[pages.length - 1];

  // expected length of last page text based on its startChar
  const needLen = Math.max(0, expectedLen - last.startChar);

  if (last.text.length > needLen) last.text = last.text.slice(0, needLen);
  else if (last.text.length < needLen) last.text = last.text.padEnd(needLen, ' ');

  last.endChar = expectedLen;
  cursor = expectedLen;
}


DEV-валидация (не обязательно, но полезно): после пагинации пройтись по страницам и проверить инварианты:

if (process.env.NODE_ENV !== 'production') {
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (p.endChar - p.startChar !== p.text.length) {
      console.warn('[paginate] invariant broken', { i, start: p.startChar, end: p.endChar, textLen: p.text.length });
    }
    if (i > 0 && pages[i-1].endChar !== p.startChar) {
      console.warn('[paginate] gap/overlap', { i, prevEnd: pages[i-1].endChar, start: p.startChar });
    }
  }
  if (pages.length && pages[pages.length-1].endChar !== currentChapter.plainText.length) {
    console.warn('[paginate] total mismatch', { lastEnd: pages[pages.length-1].endChar, expected: currentChapter.plainText.length });
  }
}

PR2 — Restore: безопасный вызов async через optional chaining (обязательное)
Цель

Никаких undefined.catch и “падений на старте”.

Файл

Reader.tsx (или wherever restore happens)

Шаблон

Запрещено:

readerRef.current?.goToCharOffset(...).catch(...)


Разрешено:

const p = readerRef.current?.goToCharOffset(...);
p?.catch(() => {});


То же для goToChapterAtOffset, goToPosition, любых async методов.

PR3 — Engine: EPUB indexing invariant (обязательное)
Цель

chapter.index должен быть плотным (0..N-1) и совпадать с позицией в content.chapters[].

Файл

ReaderEngine.ts

Шаги

В EPUB parsing использовать chapterIdx++, не index: i:

let chapterIdx = 0;
for (let i = 0; i < spine.length; i++) {
  ...
  if (!manifestItem || !manifestItem.mediaType.includes('html')) continue;

  const parsed = this.parseEPUBChapter(htmlContent, chapterIdx);

  chapters.push({
    index: chapterIdx,
    title: parsed.title,
    content: parsed.html,
    plainText: parsed.text,
    ...
  });

  chapterIdx++;
}


В canonicalizeOffsets(content) сделать “железобетон” — принудительно проставить index: i:

const chapters = content.chapters.map((ch, i) => ({
  ...ch,
  index: i,
  plainText: canonicalizeForOffsets(ch.plainText ?? ''),
}));

// пересчитать start/end offsets заново последовательно:
let offset = 0;
const fixedChapters = chapters.map((ch) => {
  const text = ch.plainText;
  const start = offset;
  const end = start + text.length;
  offset = end;
  return { ...ch, charCount: text.length, startOffset: start, endOffset: end };
});

return { ...content, totalChars: offset, chapters: fixedChapters };

PR4 — Engine: EPUB text must match rendered HTML (обязательное)
Цель

chapter.plainText должен вычисляться из того HTML, который вы реально отображаете/пагинируете (после очистки).

Файл

ReaderEngine.ts функция parseEPUBChapter(...)

Шаги

Сначала html = cleanEPUBHTML(body.innerHTML)

Потом text = extractStructuredText(html) (или fallback stripTags + canonicalize)

PR5 — (Опционально) ReaderCore: не полагаться на chapter.index для навигации

Если вы уже сделали “железобетон” в Engine (PR3), это можно не трогать.
Но как страховка можно хранить currentChapterArrayIndex и использовать его в next/prev. Это второй слой защиты.

Мини-Acceptance (в PR description)

Qoder должен приложить результаты (скрин/лог):

Refresh restore: открыть книгу → середина → F5 → тот же абзац

Resize restore: сменить ширину/ориентацию → reopen → тот же абзац

Font change: поменять fontSize/lineHeight/margins → reopen → тот же абзац

EPUB complex: книга со списками/цитатами → reopen → ок

DEV-логов “invariant broken / gap/overlap / total mismatch” нет

Что написать Qoder одним сообщением

Если хочешь прям коротко:

Сделай PR по 4 блокам:
(1) ReaderCore: pagesRef = PageMapItem[], paginateHTML хранит {html,text,startChar,endChar}, инвариант end-start==text.length, boundary spacing + синхронизация lastPage.text/endChar/cursor.
(2) Reader.tsx: убрать .catch после optional chaining → только p?.catch.
(3) ReaderEngine: EPUB index dense (chapterIdx++), и в canonicalizeOffsets принудительно index=i + пересчёт start/end offsets.
(4) ReaderEngine: EPUB plainText считать из cleaned HTML через extractStructuredText.