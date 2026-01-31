По описанию — это именно те две правки, которые делали решение “железобетонным”, и формально всё выглядит правильно:

✅ Duplicate space prevention — добавляете boundary-space только если страница не заканчивается пробелом.
✅ Length correction sync — при подгонке длины вы теперь синхронизируете и text, и endChar, и cursor, так что инвариант
(endChar - startChar) === text.length действительно сохраняется.

Это сильно повышает стабильность:

drift на длинных главах не накапливается,

goToCharOffset по диапазонам не “уплывает”,

anchor-fallback работает предсказуемо.

Единственное, что я бы ему всё же дописал (маленькая, но важная защита)

В блоке:

const needLen = expectedLen - lastPage.startChar;
...
lastPage.text = lastPage.text.slice(0, needLen); // или padEnd


надо гарантировать, что needLen >= 0, иначе при редком кейсе (например, если startChar уже больше expectedLen из-за раннего drift) получится странная обрезка.

Рекомендация (передай Qoder):

const needLen = Math.max(0, expectedLen - lastPage.startChar);


И ещё микро-страховка: перед endsWith(' ') лучше проверять lastPage.text на null/undefined (если pushPage вдруг сохранил пустое), например:

if (!((lastPage.text || '').endsWith(' '))) { ... }