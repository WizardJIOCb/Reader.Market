Что ему передать (готовый текст, копипаст)

Ты всё правильно допилил по safety (p?.catch) и по бэкенду (settings._progress + locator вверх), плюс хорошая попытка убрать drift через extractStructuredText.
Но важно: сейчас ReaderCore считает offsets по canonicalizeForOffsets (сжатые пробелы), а генератор chapter.plainText (ReaderEngine/сервер) может отдавать другой текст (не канонический). Тогда expectedLen из другой системы координат, и правка lastPage.endChar не спасает — startChar уже уехал.
Нужно: генерить chapter.plainText в той же форме, что page-map: plainText = canonicalizeForOffsets(extractStructuredText(chapterHtml)), и по нему считать charCount/startOffset/endOffset.
Дополнительно: в paginateHTML сейчас вручную добавляется ' ' между блоками — ок только если генератор plainText делает то же; лучше привести к 1 источнику истины (extractStructuredText для whole page html).

Если хочешь — загрузи ещё ReaderEngine.ts актуальный из репо (или кусок, где формируется chapter.plainText) — и я дам прям точный патч “куда вставить canonicalize/extractStructuredText”, чтобы вы окончательно закрыли drift.

Пробежался по твоим текущим файлам — в целом Qoder сделал правильно, и ключевая вещь, которая реально “чинит” точное восстановление позиции, у вас уже есть: единая каноникализация текста для оффсетов + pageMap с startChar/endChar + restore через goToCharOffset.

Но я вижу один очень важный потенциальный баг, который может всё ещё ломать точность (особенно на EPUB), и именно это я бы ему передал.

✅ Что выглядит корректно (можно не трогать)
ReaderEngine.ts

Есть canonicalizeOffsets(content) и он прогоняет chapter.plainText через canonicalizeForOffsets и пересчитывает charCount/startOffset/endOffset/totalChars. Это прям то, что нужно для единой системы координат.

ReaderCore.tsx

paginateHTML() строит PageMapItem[] (html/text/startChar/endChar) курсорным способом, без indexOf.

plainText для страниц берётся через extractStructuredText() + canonicalizeForOffsets(), и страницы склеиваются пробелами между блоками — это норм.

⚠️ Что может быть НЕ правильно (и из-за этого “вроде всё сделали”, но иногда будет мимо)
Проблема: EPUB — plainText считается НЕ из того HTML, который реально рендерится

В parseEPUBChapter() сейчас так:

text = body.textContent

потом html = this.cleanEPUBHTML(html)

а text не пересчитывается после чистки HTML

Это значит:

в plainText могут попасть script/style/мусор/скрытые куски, которых нет в отображаемом HTML

ReaderCore пагинирует очищенный HTML, вытаскивает из него текст и строит startChar/endChar по нему

а ReaderEngine строит оффсеты по другому тексту → координаты не совпадают → восстановление позиции иногда едет

✅ Что передать Qoder (конкретный фикс)

Нужно, чтобы chapter.plainText всегда считался из того же HTML, который потом отображается/пагинируется.

Патч-идея для ReaderEngine.ts

Импортировать extractStructuredText:

import { canonicalizeForOffsets, extractStructuredText } from './textNormalization';


В parseEPUBChapter() пересчитать text из очищенного html:

private parseEPUBChapter(htmlContent: string, index: number): { title: string; html: string; text: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  const titleEl = doc.querySelector('h1, h2, title');
  const title = titleEl?.textContent?.trim() || `Chapter ${index + 1}`;

  const body = doc.body;
  let html = body?.innerHTML || '';

  // ВАЖНО: сначала чистим html
  html = this.cleanEPUBHTML(html);

  // ВАЖНО: потом извлекаем text ИМЕННО из этого html (как делает ReaderCore)
  let text = '';
  if (typeof document !== 'undefined') {
    text = extractStructuredText(html); // уже canonicalize внутри делает
  } else {
    // fallback на случай окружения без DOM
    text = canonicalizeForOffsets(this.stripTags(html));
  }

  return { title, html, text };
}


Почему так: теперь координаты в chapter.plainText будут соответствовать тому, что реально рисуется и режется на страницы в ReaderCore.