Посмотрел твой новый ReaderCore.tsx. Фикс по границе страниц — в правильную сторону, он реально закрывает тот “накопительный дрейф”, про который я писал: теперь при page-break вы учитываете 1 символ-разделитель в оффсетах.

Вот конкретно что хорошо ✅
В месте разрыва страницы теперь:

pushPage(currentPageHTML, currentPagePlainText);

// Fix page boundary spacing - account for missing separator between pages
if (pages.length > 0) {
  const lastPage = pages[pages.length - 1];
  lastPage.endChar += 1;
  cursor += 1;
}


Это делает диапазоны startChar/endChar последовательными и добавляет “виртуальный пробел” между страницами, чтобы offsets совпадали с канонической plainText-логикой.

Но есть 1 важная доработка, которую я бы попросил Qoder сделать (иначе будет “фантомный символ”)

Сейчас вы увеличиваете endChar и cursor, но не добавляете этот пробел в lastPage.text.
Из-за этого получается “фантом”:

lastPage.endChar - lastPage.startChar больше, чем lastPage.text.length на 1

этот 1 символ существует в оффсетах, но его нет в text

Это обычно не убивает восстановление, но:

может ломать любые будущие проверки/отладку,

и потенциально может мешать, если где-то появится логика “slice по text.length”.

✅ Что передать Qoder (маленький патч):

В этом же месте добавить:

if (pages.length > 0) {
  const lastPage = pages[pages.length - 1];

  // add phantom separator to both offsets and stored text to keep invariants
  lastPage.text = (lastPage.text || '') + ' ';
  lastPage.endChar += 1;
  cursor += 1;
}


Почему это безопасно:
canonicalizeForOffsets() всё равно .trim() делает, так что anchor-поиск не пострадает, а инвариант “range length == text.length” станет снова верным.

Ещё 2 микрорекомендации (опционально, но полезно)
1) Добавлять этот “+1 пробел” только когда это реально нужно

Например, можно ограничить условием:

currentPagePlainText.trim().length > 0

elementText.trim().length > 0

Чтобы не добавлять “разделитель” между пустыми страницами/элементами.

2) В dev-валидации добавить проверку инварианта

После пагинации проверить для каждой страницы:

if (pages[i].endChar - pages[i].startChar !== pages[i].text.length) warn...


Это сразу ловит такие случаи.

Что ему передать (готовый текст)

Скопируй и отправь Qoder:

Фикс boundary spacing правильный, дрейф offsets на длинных главах должен уйти. Но сейчас вы увеличиваете endChar/cursor на +1, не добавляя этот символ в lastPage.text, получается “phantom char” и ломается инвариант end-start === text.length. Лучше одновременно делать lastPage.text += ' ' (или ввести extraLen в pushPage). Также стоит добавлять +1 только если обе стороны не пустые, и в dev добавить проверку инварианта по всем страницам.

Если Qoder это докрутит — я бы уже сказал, что система стала “железобетонной” даже на длинных главах и EPUB со сложной разметкой.