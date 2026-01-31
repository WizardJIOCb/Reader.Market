Передай Qoder вот это (можно прям копипастом). Я посмотрел текущие файлы ReaderCore.tsx / Reader.tsx / routes.ts / types.ts — в целом направление правильное: вы ввели locator v2 (global charOffsetInBook + anchorText + viewport hints), сохраняете его в settings._progress.locator на бэке и восстанавливаете через goToCharOffset() — это именно то, что нужно для “точного” прогресса при разном размере экрана.

Но есть 1 критичное место, из-за которого позиция всё ещё может “плавать” и восстанавливаться неверно.

1) Критичный баг/риск: расчёт startChar/endChar страниц через indexOf

Сейчас в paginateHTML() вы вычисляете startChar/endChar так:

собираете fullPlainText из html (через tempDiv.textContent)

для каждой страницы пытаетесь найти currentPagePlainText внутри fullPlainText через indexOf (функция findTextInChapter)

если не найдено — есть fallback на поиск с 0, а если и так не найдено — возвращается startIndex

Это ломает точность, когда:

в книге часто повторяются одинаковые фразы/абзацы (очень частый кейс)

пробелы/переносы в textContent отличаются от того, как вы добавляете ' ' между блоками

indexOf цепляется не за “тот” повтор, и диапазоны начинают ехать

Итог: pagesRef.current[i].startChar/endChar может стать неверным → goToCharOffset() попадает на соседнюю страницу/место.

Что надо сделать вместо этого (надёжно)

Вообще убрать indexOf из маппинга страниц.

Правильный способ: считать startChar/endChar кумулятивно, по мере формирования страниц, т.к. мы и так идём по DOM-блокам последовательно.

Идея:

При сборке currentPagePlainText вы точно знаете сколько символов уже “выпущено” в предыдущие страницы.

Значит можно вести cursor (offset) и при pages.push() ставить диапазон без поиска.

Мини-патч (схема, можно адаптировать):

let cursor = 0; // сколько символов уже ушло в pages (в canonical plainText)

const pushPage = (html: string, text: string) => {
  const startChar = cursor;
  const endChar = cursor + text.length;
  pages.push({ html, text, startChar, endChar });
  cursor = endChar;
};

// ...внутри цикла:
if (currentHeight + elementHeight > height && currentPageHTML) {
  pushPage(currentPageHTML, currentPagePlainText);
  currentPageHTML = element.outerHTML;
  currentPagePlainText = elementText;
  currentHeight = elementHeight;
} else {
  currentPageHTML += element.outerHTML;
  currentPagePlainText += (currentPagePlainText ? ' ' : '') + elementText;
  currentHeight += elementHeight;
}

// в конце:
if (currentPageHTML) pushPage(currentPageHTML, currentPagePlainText);

Важно

Чтобы cursor совпадал с chapter.plainText (который приходит из ReaderEngine.canonicalizeOffsets()), нужно, чтобы строка, по которой вы считаете cursor, была канонизирована точно тем же способом (canonicalizeForOffsets) и правила вставки пробелов были консистентны (обычно достаточно одиночного ' ', если canonicalize схлопывает whitespace).

2) Убрать опасный fallback в findTextInChapter

Если Qoder оставит поиск (хотя лучше убрать), то минимум:

findTextInChapter() не должен делать “fallback to 0” — это гарантированно может перескочить на более ранний повтор текста и сломать диапазоны.

если indexOf не нашёл — возвращать -1 и логировать/деградировать аккуратно (например, курсором).

3) Быстрая самопроверка корректности page map (сразу ловит баги)

После пагинации сделать лёгкую проверку (в dev):

диапазоны строго возрастают

pages[0].startChar === 0

pages[last].endChar === fullPlainText.length (или близко, если есть нюансы с пробелами)

(опционально) chapter.plainText.slice(startChar, endChar) “примерно” содержит pages[i].text

Это быстро покажет, где именно расхождения.

4) Что уже хорошо сделано (пусть не ломает)

Передай Qoder, что это ок и правильно:

ReadingLocatorV2 в types.ts

сохранение locator в Reader.tsx в handlePositionChange()

восстановление в Reader.tsx через readerRef.current.goToCharOffset(locator.charOffsetInBook, { anchorText... })

бэкенд: хранение locator в reading_progress.settings._progress.locator и возврат его наверх (routes.ts)

5) Маленький нюанс: chapterIndexHint/pageHintInChapter сейчас не используются

В goToCharOffset() вы принимаете chapterIndexHint/pageHintInChapter, но фактически:

chapter вычисляете по charOffsetInBook

page вычисляете по startChar/endChar

pageHintInChapter не используете (можно как оптимизацию — стартовать поиск рядом)

Это не баг, просто либо используйте для ускорения/фолбэка, либо уберите, чтобы не вводить в заблуждение.

Что ему передать одним сообщением

Если хочешь совсем коротко (и максимально “plug-and-play” для Qoder), отправь ему это:

“Главная проблема — paginateHTML маппит startChar/endChar через indexOf по fullPlainText, это ломается на повторяющихся фрагментах и различиях whitespace. Надо убрать indexOf и считать startChar/endChar кумулятивным cursor при сборке страниц. Также убрать fallback поиска с 0. Добавить dev-проверку, что диапазоны возрастают и покрывают весь plainText.”


Задача для Qoder: Accurate Reading Position v2 — фикс page-map (убрать indexOf, перейти на cursor)
Контекст

Сейчас прогресс чтения сохраняется как ReadingLocatorV2 (global charOffsetInBook + anchorText + hints) и восстанавливается через ReaderCore.goToCharOffset().

Проблема остаётся из-за того, что в ReaderCore.paginateHTML() page-map (startChar/endChar) вычисляется через поиск indexOf по fullPlainText. Это ломается на:

повторяющихся фрагментах текста,

различиях whitespace между HTML->text и chapter.plainText,

“fallback” поиска с 0 (переносит в раннее совпадение).

В результате startChar/endChar могут стать неверными → goToCharOffset() попадает на соседнюю страницу.

Цель

Сделать page-map детерминированным: startChar/endChar должны считаться кумулятивным cursor при сборке страниц, без indexOf.

Изменения
1) ReaderCore.tsx — paginateHTML: page-map через cursor (без indexOf)

Файл: ReaderCore.tsx
Функция: paginateHTML(...) (или эквивалент, где вы формируете pages)

Сделать:

Ввести let cursor = 0;

При каждом pages.push(...) писать:

startChar = cursor

endChar = cursor + pageText.length

затем cursor = endChar

Важно по тексту страницы:

pageText должен быть канонизирован тем же способом, что и chapter.plainText (у вас уже есть canonicalizeForOffsets() или аналог).

При сборке currentPagePlainText обязательно добавлять пробел между блоками:

currentPagePlainText += (currentPagePlainText ? ' ' : '') + elementText

Убрать/не использовать:

findTextInChapter(...)

любые indexOf для вычисления start/end

“fallback поиск с 0” (его нельзя оставлять)

Результат: PageMapItem[] с корректными startChar/endChar, строго возрастающими.

2) ReaderCore.tsx — dev-валидация page-map (для отлова расхождений)

После пагинации (в dev / под флагом) добавить проверки:

pages[0].startChar === 0

pages[i].startChar === pages[i-1].endChar

pages[last].endChar === canonicalChapterText.length
(допускаем небольшую разницу только если вы намеренно режете пробелы; лучше добиться точного совпадения)

Если проверка не проходит — логируем:

chapterIndex

cursor/endChar

lengths

первые 80 символов chapter.plainText и первой страницы (для понимания)

3) ReaderCore.goToCharOffset — использовать page-map диапазоны

Убедиться что goToCharOffset() выбирает страницу так:

page.startChar <= localOffset < page.endChar

Если localOffset вне диапазона (например localOffset == endChar last page):

clamp на последнюю страницу.

Anchor fallback оставить, но он теперь будет нужен гораздо реже.

4) ReaderEngine.ts — единая канонизация оффсетов (если ещё не сделано)

Если уже сделано — не трогаем.
Если нет — сделать так, чтобы:

chapter.plainText = canonicalizeForOffsets(rawText)

charCount/startOffset/endOffset считаются по этому plainText

totalChars пересчитан после канонизации

Важно: toLowerCase() нельзя использовать для расчёта оффсетов. Lowercase — только для поиска/сравнения anchor.

5) Backend: не перетирать reader settings

Проверить, что:

прогресс хранится в reading_progress.settings._progress

reader settings хранятся в reading_progress.settings (без перетирания)

PUT /reading-progress делает merge, а не замену settings целиком

GET /reading-progress возвращает locator наверх (для Reader.tsx)

(Если это уже сделано — ок. Просто не сломать.)

Критерии приёмки (Acceptance Criteria)

Открыл книгу → пролистал/прочитал → закрыл вкладку → открыл снова:
возвращает на тот же текст (максимум погрешность 0–1 страница, лучше 0).

Повторить тест после:

смены ширины окна (desktop ↔ mobile),

смены fontSize/lineHeight/margins/theme,

поворота экрана (если mobile).

Книга с повторяющимися фрагментами (или главы с одинаковыми абзацами):
восстановление не прыгает на более ранний повтор.

Dev-валидация page-map проходит: диапазоны покрывают chapter.plainText последовательно.

Тест-план (manual)

Включить paginated mode.

Пролистать на страницу в середине длинной главы (где точно есть повторяющиеся слова/фразы).

Поставить закладку “визуально” (запомнить абзац).

Обновить страницу → проверить возврат.

Сменить fontSize + margins → обновить → проверить возврат.

Сузить окно до мобилки → обновить → проверить возврат.

Проверить, что в API прогресса (/reading-progress) locator сохраняется и возвращается.

Что нужно прислать в PR

Изменённый ReaderCore.tsx (paginateHTML + валидация + корректная позиция)

(Если трогали) ReaderEngine.ts (канонизация оффсетов)

(Если трогали) routes.ts (merge settings/_progress)

Короткий отчет: “как проверил” по тест-плану.