По тем файлам, что ты скинул (ReaderEngine.ts + ReaderCore.tsx + textNormalization.ts), в целом он сделал правильно: это действительно выглядит как “полный набор” для точного восстановления позиции по глобальному charOffset + pageMap(startChar/endChar) + anchorText.

Но есть 1 важный инвариант, который я бы ему прямо сейчас попросил жёстко гарантировать в коде, иначе часть логики может “стрельнуть” на некоторых книгах/форматах.

✅ Что уже сделано хорошо (и это реально закрывает баги)

Единая “координатная система” текста
canonicalizeForOffsets() (без lowerCase) + одинаковое извлечение текста через extractStructuredText() → это правильно.
То, что ReaderEngine канонизирует plainText, а ReaderCore строит pageMap из канонизированного текста — это прям то, что нужно.

PageMapItem[] вместо строк
Пагинация в ReaderCore теперь хранит PageMapItem { html, text, startChar, endChar } и считает диапазоны через cursor — ✅.

goToCharOffset с anchor fallback
Логика “восстанови по диапазону → если anchor не совпал, попробуй соседние/глобально” — ✅ и это как раз спасает от дрейфа из-за разной пагинации.

Backend хранит прогресс отдельно от настроек
Складывание прогресса в settings._progress, не затирая reader settings — ✅.

⚠️ Что обязательно передать ему (чтобы было железобетонно)
1) Гарантировать инвариант: chapter.index === index в массиве chapters

Сейчас в ReaderCore навигация и расчёты используют currentChapter.index как индекс массива:

content.chapters[currentChapter.index + 1]

content.chapters[currentChapter.index - 1]

циклы for (let i = 0; i < currentChapter.index; i++)

Это будет корректно только если chapter.index всегда равен фактическому индексу в content.chapters[].

✅ В EPUB он уже сделал chapterIdx плотным (0..N-1) — это хорошо.
Но чтобы не зависеть от парсеров/будущих изменений, лучше зафиксировать это в одном месте:

Передай ему:

“Пожалуйста, в ReaderEngine.canonicalizeOffsets() принудительно проставь index: i для каждой главы при маппинге, чтобы chapter.index всегда совпадал с позицией в массиве.”

Примерно так (идея, не обязательно дословно):

в content.chapters.map((ch, i) => ({ ...ch, index: i, ... }))

Это один маленький штрих, который убирает целый класс скрытых багов.

2) (Опционально) opts.chapterIndexHint сейчас не используется

Это не баг, но если уж поле есть — можно оптимизировать: сначала проверять hinted chapter, а уже потом findIndex по offsets. Не критично.

🧪 Мини-чеклист тестов (прямо ему как acceptance)

Попроси его прогнать и подтвердить логами [RESTORE]:

Открыть книгу → уйти в середину → обновить страницу → попасть в тот же абзац

Сменить ширину окна (desktop ↔ mobile) → обновить → тот же абзац

Поменять fontSize/lineHeight/margins → обновить → тот же абзац

EPUB с “нестандартными” главами (картинки/цитаты/списки) — чтобы anchor fallback отрабатывал.

Сообщение, которое можно просто скопировать и отправить Qoder

“В целом реализация ок и соответствует ТЗ: canonical text + pageMap(start/end) + goToCharOffset + anchor fallback + хранение locator v2. Единственная критичная просьба: гарантировать инвариант chapter.index === индекс в массиве chapters. Сейчас ReaderCore навигацию делает через content.chapters[currentChapter.index ± 1] и циклы до currentChapter.index, поэтому надо принудительно проставлять index: i при финальной нормализации контента (лучше всего в ReaderEngine.canonicalizeOffsets()). После этого прогнать 3 теста: restore после refresh, после смены ширины, после смены fontSize — попадание в тот же абзац.”