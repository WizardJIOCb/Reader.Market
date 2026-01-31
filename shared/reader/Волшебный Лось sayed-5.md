Передай Qoder вот это как “финальный допил”, чтобы добить баги, которые всё ещё могут давать съезд позиции:

Сообщение для Qoder (копипаст)

Ты сделал всё почти правильно: ReadingLocatorV2 сохраняется, settings._progress на бэке не затирает настройки, paginateHTML считает startChar/endChar через cursor (это супер). Осталось 2 критичных защитных шага, иначе всё ещё будут редкие смещения.

1) Нужно валидировать, что page-map (cursor) совпадает с длиной chapter.plainText из ReaderEngine

Сейчас paginateHTML считает cursor по measureDiv.textContent, но goToCharOffset() использует localOffset, который пришёл из ReaderEngine (канонизированный chapter.plainText).

Если длины хоть немного расходятся (часто на разных HTML/параграфах/nbsp), то:

localOffset может выйти за pages[last].endChar

попадём на неверную страницу или clamp не туда.

Что сделать:

Передавать в paginateHTML() ожидаемую длину каноничного текста главы: expectedLen = currentChapter.plainText.length

После построения pages:

если cursor !== expectedLen, логнуть warning и подправить последнюю страницу, чтобы endChar ровно стал expectedLen (а startChar не трогать).

если cursor > expectedLen — clamp endChar на expectedLen.

если cursor < expectedLen — расширить endChar последней страницы до expectedLen.

Пример:

function paginateHTML(html, width, height, settings, expectedLen?: number): PageMapItem[] {
  ...
  // после pushPage(...) и dev sequential-check:
  if (typeof expectedLen === 'number' && pages.length > 0) {
    const last = pages[pages.length - 1];
    if (cursor !== expectedLen) {
      console.warn(`[PAGE-MAP] cursor(${cursor}) != expectedLen(${expectedLen}). Adjusting last.endChar.`);
      last.endChar = expectedLen;
    }
  }
  return pages.length ? pages : ...
}


И в ReaderCore при вызове:

const pages = paginateHTML(currentChapter.content, w, h, settings, currentChapter.plainText.length);

2) Добавить жёсткую проверку “sequential + cover”

Сейчас есть dev-проверка на последовательность без “gap”, но нужно ещё cover-check:

pages[0].startChar === 0

pages[i].startChar === pages[i-1].endChar

pages[last].endChar === expectedLen

Если нет — логнуть chapterIndex + несколько метрик. Это быстро ловит расхождения.

3) Мелочь, но важно: toLowerCase() нигде не должен участвовать в расчёте оффсетов

У тебя normalizePlainText = canonicalizeForOffsets — ок.
toLowerCase() допустим только в поиске (goToChapterAndFindText) и сравнении anchor, но не в startChar/endChar и не в chapter.plainText оффсетах.

4) Бэкенд у тебя уже ок, но проверь один момент

PUT /reading-progress и PUT /reader-settings должны делать merge и сохранять _progress — у тебя это сделано правильно. Главное: не допустить, чтобы кто-то снова начал класть settings = { pageInChapter... } и затирать настройки читалки.

Почему это важно (коротко)

Даже с cursor-пагинацией иногда DOM->text даёт микросдвиги (nbsp, скрытые пробелы, маргины). Если cursor != chapter.plainText.length, locator становится “почти точным” и иногда уедет на страницу выше/ниже. Принудительная коррекция last.endChar на expectedLen это убирает.