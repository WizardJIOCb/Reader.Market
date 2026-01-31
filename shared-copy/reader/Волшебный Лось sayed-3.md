Передай Qoder вот это (по текущему коду, который ты прислал). Сейчас у вас почти всё сделано, но есть 2 критических блокера, из-за которых “точная позиция” всё равно будет съезжать.

0) Что уже хорошо сделано

На фронте вы ввели ReadingLocatorV2 (charOffsetInBook + anchorText + hints) и восстанавливаете через readerRef.goToCharOffset() — это правильное направление.

В ReaderCore.goToCharOffset() уже есть логика:

найти главу по диапазонам startOffset/endOffset

найти страницу по startChar/endChar

если не совпало — fallback по anchorText

1) Блокер №1 — Backend сейчас НЕ сохраняет locator

В routes.ts ваш PUT /api/books/:bookId/reading-progress делает:

const { currentPage, totalPages, percentage, chapterIndex, pageInChapter, totalPagesInChapter } = req.body;
const settings = { pageInChapter, totalPagesInChapter };


То есть locator (v2) просто игнорируется.
В результате:

v2 живёт только в localStorage,

на другом устройстве/после чистки storage точность пропадает,

а иногда вы сами попадаете в legacy-fallback.

Что нужно сделать (Backend)

Расширить settings JSON в reading_progress.settings:

settings.locator (ReadingLocatorV2)

оставить существующее pageInChapter/totalPagesInChapter

PUT должен принимать locator и сохранять:

const { locator, pageInChapter, totalPagesInChapter, ... } = req.body;
const settings = { pageInChapter, totalPagesInChapter, locator };


GET /reading-progress должен возвращать locator обратно (в том же объекте progress).

Миграция БД не нужна, т.к. reading_progress.settings уже JSONB — просто расширяете структуру.

2) Блокер №2 — несогласованные “символьные оффсеты” (из-за normalizePlainText)

Это главная причина “съезда”.

Что происходит сейчас

ReaderEngine строит chapter.plainText, startOffset/endOffset по сырому тексту (как есть, без collapse/trim/lowercase).

ReaderCore при пагинации делает normalizePlainText():

collapse whitespace

trim

toLowerCase

И потом PageMapItem.startChar/endChar относятся к нормализованному тексту, а chapter.startOffset — к сырому.

В итоге вы сохраняете:

charOffsetInBook = chapter.startOffset + pageMap.startChar


…где startOffset и startChar считаются в разных системах координат → оффсет “точный”, но на самом деле уже неверный. Поэтому восстановление прыгает.

Что нужно сделать (Frontend/Engine)

Нужна единая каноническая текстовая модель для оффсетов.

Самый простой и рабочий путь:

Вариант A (рекомендую): сделать канонизацию в ReaderEngine и использовать её везде

Вынести общий helper, например canonicalizeForOffsets(text):

заменяет \u00A0 на пробел

нормализует переносы

collapse whitespace (если делаете — то делайте везде одинаково)

НЕ делать toLowerCase для оффсетов (можно делать lower только для поиска)

trim — либо везде, либо нигде (я бы делал trim на уровне глав одинаково)

ReaderEngine:

формирует chapter.plainText = canonicalizeForOffsets(strippedText)

charCount/startOffset/endOffset — по этой же строке

ReaderCore:

когда извлекает tempDiv.textContent для страницы — тоже прогоняет через тот же canonicalizeForOffsets

PageMapItem.startChar/endChar вычисляются в той же системе

goToCharOffset() сравнивает localOffset с startChar/endChar — и это начинает работать стабильно.

Lowercase оставить только для сравнения anchorText (поисковая нормализация может быть отдельной функцией normalizeForSearch()).

Вариант B: не трогать ReaderEngine, а убрать normalize в ReaderCore

Тоже возможно, но обычно сложнее, потому что HTML→text может давать странные пробелы. Вариант A обычно устойчивее.

3) Ещё 2 правки, которые стоит сделать, чтобы было “plug-and-play”
3.1 В progressData сейчас смешаны overall-pages и chapter-pages

Сейчас вы сохраняете:

currentPage = overall

но pageHintInChapter = position.pageInChapter (chapter)

а backend ждёт pageInChapter/totalPagesInChapter отдельными полями (и вы их НЕ отправляете)

Надо:

В progressData добавить pageInChapter и totalPagesInChapter (явно)

И отправлять их на сервер, чтобы backend сохранил в settings:

const progressData = {
  currentPage: currPageOverall,
  totalPages: totPagesOverall,
  percentage: position.percentage,
  chapterIndex: position.chapterIndex,
  pageInChapter: position.pageInChapter,
  totalPagesInChapter: position.totalPagesInChapter,
  locator,
};

3.2 Восстановление: сначала locator, потом fallback

Это у вас уже так. Но после того как backend начнёт отдавать locator, важно:

брать progress.locator из API,

и не затирать его legacy-объектом без locator.

Короткое сообщение для Qoder (можно прям копипастой)

Backend сейчас не сохраняет locator v2: в PUT /reading-progress он игнорируется и settings содержит только {pageInChapter,totalPagesInChapter}. Нужно сохранять settings.locator = ReadingLocatorV2 и отдавать его в GET.

Текущие символьные оффсеты неверные: ReaderEngine считает startOffset по сырому тексту, а ReaderCore делает normalizePlainText() (collapse+trim+lowercase) и по нему считает PageMapItem.startChar/endChar. Это разные системы координат → charOffsetInBook получается “кривой”. Нужно единое canonicalizeForOffsets() и использовать его и в ReaderEngine (chapter.plainText/startOffset/endOffset), и в ReaderCore (page text + startChar/endChar). Lowercase — только для поиска/anchor сравнения, не для оффсетов.

В progressData добавить явные pageInChapter/totalPagesInChapter и отправлять на сервер вместе с locator.

Если хочешь — я могу прямо по вашим файлам предложить конкретные куски кода для canonicalizeForOffsets() и где именно в ReaderEngine.ts лучше его вставить (минимальным диффом).

Я: Да давай


Передай Qoder вот это (это прям “plug-and-play” чек-лист + конкретные патчи). Сейчас у тебя позиция плывёт по двум главным причинам:

Нормализация текста в ReaderCore делает toLowerCase() → ломает стабильность charOffset (и в целом это не должно влиять на оффсеты).

Пагинация склеивает тексты блоков без пробела ("hello" + "world" => "helloworld") → findTextInChapter() часто не находит совпадение и возвращает fallback-индекс, из-за чего startChar/endChar страниц становятся неверными.

Дополнительно критично: backend сейчас перетирает reading_progress.settings (а это у тебя одновременно “настройки читалки”), потому что /reading-progress PUT кладёт туда {pageInChapter,totalPagesInChapter} и затирает все reader settings. Это может приводить к пере-пагинации и “скачкам” позиции.

Ниже — что именно исправить.

0) Добавить общий нормализатор (чтобы ReaderEngine и ReaderCore считали оффсеты одинаково)

Создать файл textNormalization.ts рядом с ReaderCore/ReaderEngine:

// textNormalization.ts
export function canonicalizeForOffsets(text: string): string {
  return (text ?? '')
    .replace(/[\s\u00a0]+/g, ' ') // все пробелы/переводы/nbsp -> один пробел
    .trim();
}

export function normalizeForSearch(text: string): string {
  return canonicalizeForOffsets(text).toLowerCase();
}

1) ReaderEngine.ts — привести chapter.plainText, charCount, startOffset/endOffset к канонической форме

В ReaderEngine.ts импортировать и прогнать контент через “канонизацию” после парсинга:

import { canonicalizeForOffsets } from './textNormalization';


И добавить метод + вызов (после switch(format)… перед this.content = content):

// после того как получили `content` из parseFB2/parseTXT/parseEPUB/parsePDF
content = this.canonicalizeOffsets(content);

this.content = content;
this.currentPosition = this.createInitialPosition();
return content;


Метод:

private canonicalizeOffsets(content: BookContent): BookContent {
  let offset = 0;

  const chapters = content.chapters.map((ch) => {
    const plain = canonicalizeForOffsets(ch.plainText ?? '');
    const charCount = plain.length;

    const next = {
      ...ch,
      plainText: plain,
      charCount,
      startOffset: offset,
      endOffset: offset + charCount,
    };

    offset += charCount;
    return next;
  });

  return { ...content, chapters, totalChars: offset };
}


Важно: это делает оффсеты стабильными для любых форматов (FB2/TXT/EPUB/PDF).

2) ReaderCore.tsx — убрать toLowerCase() из оффсет-нормализации + починить склейку блоков

В ReaderCore.tsx:

2.1 Импортировать канонизацию
import { canonicalizeForOffsets } from './textNormalization';

2.2 Заменить normalizePlainText() (или удалить)

Сейчас у тебя:

function normalizePlainText(text: string): string {
  return (text || '')
    .replace(/[\s\u00a0]+/g, ' ')
    .trim()
    .toLowerCase();
}


Нужно без lowercase (или вообще не держать отдельную, а везде canonicalizeForOffsets):

function normalizePlainText(text: string): string {
  return canonicalizeForOffsets(text);
}

2.3 Починить пагинацию: добавлять пробел между блоками

В paginateHTML() в двух местах, где накапливается currentPagePlainText:

Было:

currentPagePlainText += elementText;


Надо:

currentPagePlainText += (currentPagePlainText ? ' ' : '') + elementText;


И в ветке “start new page” тоже:

currentPagePlainText = elementText; // ок, это новая страница

2.4 findTextInChapter() — НЕ lowercasing, индекс должен считаться по каноническому тексту

Оставить простым (работает на уже канонизированных строках):

function findTextInChapter(chapterText: string, searchText: string, startIndex: number = 0): number {
  if (!searchText) return startIndex;

  const foundIndex = chapterText.indexOf(searchText, startIndex);
  if (foundIndex === -1 && startIndex > 0) {
    const again = chapterText.indexOf(searchText, 0);
    return again === -1 ? startIndex : again;
  }
  return foundIndex === -1 ? startIndex : foundIndex;
}

3) Reader.tsx — прогресс должен отправлять pageInChapter/totalPagesInChapter + locator, и anchorText должен быть каноничным
3.1 В handlePositionChange добавь поля в progressData (они у тебя уже есть в position)

Сейчас ты сохраняешь:

const progressData = {
  currentPage: currPageOverall,
  totalPages: totPagesOverall,
  percentage: position.percentage,
  chapterIndex: position.chapterIndex,
  locator,
};


Нужно:

const progressData = {
  currentPage: currPageOverall,
  totalPages: totPagesOverall,
  percentage: position.percentage,
  chapterIndex: position.chapterIndex,

  // добавляем:
  pageInChapter: position.pageInChapter,
  totalPagesInChapter: position.totalPagesInChapter,

  locator,
};

3.2 anchorText оставь как есть, но лучше тоже через canonicalizeForOffsets

(не обязательно, но правильно). Сейчас ты делаешь .replace(/[\s\u00a0]+/g,' ').trim() — это уже совпадает.

4) routes.ts — НЕ ЗАТИРАТЬ reading_progress.settings (там у тебя reader settings), хранить прогресс отдельно внутри settings._progress

Сейчас /api/books/:bookId/reading-progress PUT делает:

const settings = { pageInChapter, totalPagesInChapter };
await storage.updateReadingProgress(... { settings })


Это ломает reader settings.

4.1 Исправить PUT /reading-progress: merge + settings._progress
app.put("/api/books/:bookId/reading-progress", authenticateToken, async (req, res) => {
  try {
    const { bookId } = req.params;
    const userId = (req as any).user.userId;

    const { currentPage, totalPages, percentage, chapterIndex, pageInChapter, totalPagesInChapter, locator } = req.body;

    const existing = await storage.getReadingProgress(userId, bookId);
    const prevSettings = (existing?.settings && typeof existing.settings === 'object') ? existing.settings : {};

    const nextSettings = {
      ...prevSettings,
      _progress: {
        ...(prevSettings as any)._progress,
        pageInChapter,
        totalPagesInChapter,
        locator, // сюда кладём ReadingLocatorV2
      },
    };

    const progress = await storage.updateReadingProgress(userId, bookId, {
      currentPage,
      totalPages,
      percentage,
      chapterIndex,
      settings: nextSettings,
      lastReadAt: new Date(),
    });

    // удобно клиенту: дублируем наверх
    const prog = (progress.settings as any)?._progress;
    res.json({
      ...progress,
      pageInChapter: prog?.pageInChapter,
      totalPagesInChapter: prog?.totalPagesInChapter,
      locator: prog?.locator,
    });
  } catch (error) {
    console.error("Error updating reading progress:", error);
    res.status(500).json({ error: "Failed to update reading progress" });
  }
});

4.2 GET /reading-progress: тоже вернуть locator и chapter-поля наверх (чтобы Reader.ts увидел progress.locator)

В GET /api/books/:bookId/reading-progress после получения progress:

const prog = (progress.settings as any)?._progress;

res.json({
  ...progress,
  pageInChapter: prog?.pageInChapter,
  totalPagesInChapter: prog?.totalPagesInChapter,
  locator: prog?.locator,
});

4.3 GET /reader-settings: возвращать ТОЛЬКО настройки, без _progress

Сейчас:

res.json(progress.settings);


Надо:

const settingsObj = (progress.settings && typeof progress.settings === 'object') ? progress.settings : {};
const { _progress, ...readerSettings } = settingsObj as any;
res.json(readerSettings);

4.4 PUT /reader-settings: merge и сохранить _progress

Сейчас просто const settings=req.body; updateReadingProgress(... settings) — перетирает _progress.

Надо:

const existing = await storage.getReadingProgress(userId, bookId);
const prev = (existing?.settings && typeof existing.settings === 'object') ? existing.settings : {};
const prevProgress = (prev as any)._progress;

const next = { ...prev, ...settings, _progress: prevProgress };

await storage.updateReadingProgress(userId, bookId, { settings: next, lastReadAt: existing?.lastReadAt ?? new Date() });

Что именно сказать Qoder одной фразой

“Нужно, чтобы оффсеты считались по одному канону без lowercase, пагинация склеивала блоки с пробелом, ReaderEngine пересчитывал plainText/startOffset после парсинга, а backend перестал затирать reading_progress.settings и хранил прогресс в settings._progress, возвращая locator наверх.”

Если хочешь — я могу прямо по твоим текущим файлам собрать готовые “diff-патчи” кусками (уже почти сделал логикой выше), чтобы Qoder просто вставил изменения без раздумий.