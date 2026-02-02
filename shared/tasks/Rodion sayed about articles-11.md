Посмотрел reader.market.zip — стало заметно лучше: ArticlesPage и BookDetail сейчас уже близки к “как надо”. Но есть одна критичная проблема в BookArticlesTab.tsx, из-за которой может начаться бесконечный рефетч (и лишняя нагрузка), плюс пара косметических правок.

✅ Что хорошо
client/src/pages/ArticlesPage.tsx

✅ Есть 2 useEffect (reset page + load) — фильтры/поиск/пагинация реально работают.

✅ views используется правильно.

✅ author сделал optional, tags safe (const tags = article.tags ?? []) — крашей не будет.

✅ Показываешь Найдено: {totalArticles} — отлично.

client/src/pages/BookDetail.tsx

✅ Вкладка “Статьи” добавлена корректно: grid-cols-3, счётчик …/N, TabsContent подключает <BookArticlesTab … onTotalChange />.

✅ Есть сброс articlesTotal при смене bookId.

client/src/pages/ReadLaterPage.tsx / ArticleDetailPage.tsx

✅ authToken, href, slug — всё ок.

✅ setIsSaved(!!isReadLater) есть.

❌ Главная проблема (важно): BookArticlesTab.tsx может уйти в бесконечный запрос

Сейчас у тебя:

const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;

useEffect(() => { ... fetch(..., { headers }) ... }, [..., headers, ...])


headers — это новый объект на каждом рендере, поэтому dependency headers всегда “меняется” → useEffect снова срабатывает → setData → рендер → снова useEffect… и так по кругу.

✅ Как исправить (минимальный патч)

Сделай headers стабильным через useMemo

В deps лучше класть authToken, а не headers.

В catch не сбрасывать счётчик в 0 (иначе вкладка будет “Статьи (0)” от любого сетевого сбоя).

Вот готовая правка (копипаст):

import React, { useEffect, useMemo, useState } from "react";
// useMemo уже нужен

const authToken = localStorage.getItem("authToken") || "";

const headers = useMemo(() => {
  return authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
}, [authToken]);

useEffect(() => {
  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("limit", String(limit));
      qs.set("sortBy", sortBy);
      qs.set("sortOrder", sortOrder);
      if (role !== "all") qs.set("role", role);

      const res = await fetch(`/api/books/${bookId}/articles?${qs.toString()}`, { headers });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);

      const json = (await res.json()) as ApiResult;
      setData(json);
      onTotalChange?.(json.total ?? 0);
    } catch (e) {
      console.error(e);
      // НЕ затираем счётчик и данные в 0 без необходимости:
      // можно оставить data как есть, либо показать сообщение об ошибке.
      // setData(prev => prev ?? { articles: [], total: 0, page, limit, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  };

  load();
}, [bookId, page, limit, role, sortBy, sortOrder, authToken, onTotalChange]);


Если хочешь прям аккуратно: добавь const [error,setError]=useState<string|null>(null) и показывай error-блок вместо принудительного setData({ articles: [] ... }).

Мелочи (не критично, но лучше подчистить)
BookArticlesTab.tsx

Сейчас импортируется useMemo, но до фикса он был лишний; после фикса нужен — ок.

onTotalChange?.(0) в catch — лучше убрать (см. выше).

ArticlesPage.tsx

MessageCircle импортирован, но не используется — можно удалить, чтобы не ругался линтер.

Что сказать Qoder одним сообщением

“Всё стало хорошо, но в BookArticlesTab.tsx есть критичный баг: headers создаётся как новый объект каждый render и стоит в deps useEffect → возможен бесконечный refetch. Нужно мемоизировать headers через useMemo и в deps использовать authToken (строку), а не headers. И убрать onTotalChange(0) из catch — не затирать счётчик при сетевых ошибках.”