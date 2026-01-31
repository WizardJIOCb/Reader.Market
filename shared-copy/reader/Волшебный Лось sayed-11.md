Посмотрел ReaderCore.tsx и сверил с тем, как сейчас устроена навигация/оффсеты. В целом — у вас всё в правильном направлении, но есть один “скрытый” риск, который реально может ломать главы и восстановление на EPUB.

Главное, что я бы передал Qoder (обязательно)
1) ReaderCore.tsx сейчас завязан на currentChapter.index как на индекс массива глав

В ReaderCore.tsx у тебя много мест вида:

const nextChapter = content.chapters[currentChapter.index + 1];
const prevChapter = content.chapters[currentChapter.index - 1];
for (let i = 0; i < currentChapter.index; i++) ...
currentChapterIndexRef.current = currentChapter.index;


Это работает только если chapter.index == реальная позиция главы в content.chapters[] (0..N-1 без дыр).

А в EPUB-парсинге легко появляются “дыры” (если в spine есть не-html элементы, они пропускаются). Тогда:

next/prev главы могут открываться не те

оценка overall pages (estimated) будет неверной

restore может “скакать”

✅ Что передать Qoder:
Нужно гарантировать одно из двух (лучше оба):

Вариант A (быстрый и правильный): починить индексацию глав в ReaderEngine (EPUB)

В ReaderEngine.ts в parseEPUB() сейчас часто делают index: i (spine index). Это опасно.
Нужно index делать плотным: 0..chapters.length-1.

Пример патча:

const chapters: Chapter[] = [];
let currentOffset = 0;
let chapterIdx = 0;

for (let i = 0; i < spine.length; i++) {
  ...
  if (!manifestItem || !manifestItem.mediaType.includes('html')) continue;
  ...
  const htmlContent = await contentFile.async('string');

  // Важно: передаём chapterIdx, чтобы нумерация глав тоже была плотной
  const { title: chapterTitle, html, text } = this.parseEPUBChapter(htmlContent, chapterIdx);

  chapters.push({
    index: chapterIdx,
    title: chapterTitle,
    content: html,
    plainText: text,
    charCount: text.length,
    startOffset: currentOffset,
    endOffset: currentOffset + text.length,
  });

  currentOffset += text.length;
  chapterIdx++;
}

Вариант B (страховка): ReaderCore не должен доверять chapter.index для навигации по массиву

Даже если Engine починили — лучше застраховаться, чтобы дальше никакой формат не сломал ReaderCore.

✅ Патч-идея для ReaderCore:

Ввести “реальный индекс текущей главы в массиве”:

const [currentChapterArrayIndex, setCurrentChapterArrayIndex] = useState(0);

const setChapterByArrayIndex = useCallback((idx: number) => {
  if (!content) return;
  const safe = Math.max(0, Math.min(idx, content.chapters.length - 1));
  const ch = content.chapters[safe];
  setCurrentChapter(ch);
  setCurrentChapterArrayIndex(safe);
  currentChapterIndexRef.current = safe;
  onChapterChange?.(ch);
}, [content, onChapterChange]);


И дальше в nextPage/prevPage использовать currentChapterArrayIndex, а не currentChapter.index.

} else if (currentChapterArrayIndex < content.chapters.length - 1) {
  setChapterByArrayIndex(currentChapterArrayIndex + 1);
  setCurrentPage(0);
}


То же — для prevPage, и для getEstimatedCurrentPageOverall().

Ещё 1 важный момент по EPUB (если он у него “поправил”, пусть проверит)

В parseEPUBChapter() текст должен считаться из очищенного HTML, иначе offsets могут не совпасть с ReaderCore.

Т.е. после html = cleanEPUBHTML(html) делать:

text = extractStructuredText(html); // и уже канонизированный


(А не body.textContent до чистки.)

Короткое сообщение Qoder (копипаст)

В ReaderCore навигация и overall-page estimation завязаны на currentChapter.index как на индекс массива content.chapters[] (next/prev: chapters[currentChapter.index ± 1], цикл for i < currentChapter.index, currentChapterIndexRef = currentChapter.index). Это ломается, если chapter.index не плотный (EPUB spine часто пропускает non-html и появляются “дыры”).
Нужно:

В ReaderEngine parseEPUB сделать index плотным (chapterIdx++), а не spine i.

(Страховка) В ReaderCore хранить currentChapterArrayIndex и использовать его для next/prev/estimated overall, не полагаться на chapter.index.

В parseEPUBChapter текст извлекать из очищенного html (extractStructuredText(cleanedHtml)), чтобы offsets совпадали с пагинацией.