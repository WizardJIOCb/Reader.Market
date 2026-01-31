Да, ощущение верное: Qoder всё ещё сделал “не то” в ключевом месте. Причём это не про вкусовщину — у вас сейчас в storage.ts есть реальные баги, которые либо ломают фильтры/поиск, либо вообще не дадут проекту собраться.

Ниже — что именно не так (по твоим schema.ts / routes.ts / storage.ts) и что передать Qoder, уже в виде конкретного патча.

Что “не то” прямо сейчас
1) Критичный баг: .where() перетирает условия (фильтры не работают как надо)

В storage.listArticles() у тебя:

query = query.where(publishedCondition);
...
query = query.where(eq(articles.section, params.section));
...
query = query.where(searchCondition);


В Drizzle повторные .where() не добавляют, а заменяют условие.
➡️ В итоге реально действует только последний where, а статус published/section/format легко “теряется”. Поэтому лента ощущается кривой.

2) Критичный баг сборки: const countQuery = ...; countQuery = countQuery.where(...)

В storage.getArticles():

const countQuery = db.select({ count: count() }).from(articles);
...
countQuery = countQuery.where(and(...countConditions));


Это не скомпилируется (reassign const).
➡️ Если этот метод где-то импортируется/используется — сборка/TS упадёт.

3) /api/articles (листинг) отдаёт “плоские” поля автора и без тегов

listArticles() выбирает username/fullName/avatarUrl на верхнем уровне и не отдаёт tags и isReadLater, хотя detail (getArticle) уже отдаёт нормальную структуру.

➡️ UI либо рисует пусто/криво, либо вы вынуждены делать костыли.

4) Мусорные параметры categorySlug/publicationType в listArticles

Они в сигнатуре висят, но логики нет → создают ощущение “две системы категорий”.

Что передать Qoder (сразу “лучший вариант”)

Скопируй это Qoder’у:

✅ ТАСК: Починить listArticles/getArticles (Drizzle where bug + DTO author/tags/isReadLater)
A) Исправить storage.listArticles() — один where через and(...) + вернуть нормальный DTO

Собираем conditions: SQL[], потом where(and(...conditions)) один раз

Делаем батч-запрос тегов через articleTagLinks + articleTags

Если есть userId — батч read-later через articleReadLater

Возвращаем статьи с полем author: { ... }, tags: [], isReadLater

Готовый код (заменить полностью тело listArticles):

async listArticles(params: {
  page: number;
  limit: number;
  section?: string;
  format?: string;
  searchQuery?: string;
  sortBy: "publishedAt" | "createdAt" | "views";
  sortOrder: "asc" | "desc";
  userId?: string;
}) {
  const offset = (params.page - 1) * params.limit;

  const conditions: any[] = [eq(articles.status, "published")];

  if (params.section) conditions.push(eq(articles.section, params.section));
  if (params.format) conditions.push(eq(articles.format, params.format));

  if (params.searchQuery?.trim()) {
    const q = `%${params.searchQuery.trim()}%`;
    conditions.push(or(
      ilike(articles.title, q),
      ilike(articles.excerpt, q),
      ilike(articles.searchText, q),
    ));
  }

  const where = and(...conditions);

  let sortColumn: any;
  switch (params.sortBy) {
    case "publishedAt": sortColumn = articles.publishedAt; break;
    case "views": sortColumn = articles.views; break;
    default: sortColumn = articles.createdAt;
  }

  const orderBy = params.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  const rows = await db.select({
    id: articles.id,
    authorUserId: articles.authorUserId,
    section: articles.section,
    format: articles.format,
    status: articles.status,
    lang: articles.lang,
    title: articles.title,
    slug: articles.slug,
    excerpt: articles.excerpt,
    coverImageUrl: articles.coverImageUrl,
    views: articles.views,
    commentsCount: articles.commentsCount,
    publishedAt: articles.publishedAt,
    createdAt: articles.createdAt,
    updatedAt: articles.updatedAt,

    authorId: users.id,
    username: users.username,
    fullName: users.fullName,
    avatarUrl: users.avatarUrl,
  })
  .from(articles)
  .leftJoin(users, eq(articles.authorUserId, users.id))
  .where(where)
  .orderBy(orderBy)
  .limit(params.limit)
  .offset(offset);

  const articleIds = rows.map(r => r.id);

  // tags batch
  const tagsByArticleId = new Map<string, any[]>();
  if (articleIds.length) {
    const tagRows = await db.select({
      articleId: articleTagLinks.articleId,
      id: articleTags.id,
      axis: articleTags.axis,
      name: articleTags.name,
      slug: articleTags.slug,
    })
    .from(articleTagLinks)
    .innerJoin(articleTags, eq(articleTags.id, articleTagLinks.tagId))
    .where(inArray(articleTagLinks.articleId, articleIds))
    .orderBy(asc(articleTags.name));

    for (const tr of tagRows) {
      const arr = tagsByArticleId.get(tr.articleId) ?? [];
      arr.push({ id: tr.id, axis: tr.axis, name: tr.name, slug: tr.slug });
      tagsByArticleId.set(tr.articleId, arr);
    }
  }

  // read later batch
  let readLaterSet: Set<string> | null = null;
  if (params.userId && articleIds.length) {
    const rl = await db.select({ articleId: articleReadLater.articleId })
      .from(articleReadLater)
      .where(and(
        eq(articleReadLater.userId, params.userId),
        inArray(articleReadLater.articleId, articleIds)
      ));
    readLaterSet = new Set(rl.map(x => x.articleId));
  }

  const articlesDto = rows.map(r => ({
    id: r.id,
    authorUserId: r.authorUserId,
    section: r.section,
    format: r.format,
    status: r.status,
    lang: r.lang,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt,
    coverImageUrl: r.coverImageUrl,
    views: r.views,
    commentsCount: r.commentsCount,
    publishedAt: r.publishedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,

    author: r.authorId ? {
      id: r.authorId,
      username: r.username,
      fullName: r.fullName,
      avatarUrl: r.avatarUrl,
    } : undefined,

    tags: tagsByArticleId.get(r.id) ?? [],
    isReadLater: readLaterSet ? readLaterSet.has(r.id) : undefined,
  }));

  const countRes = await db.select({ count: count() }).from(articles).where(where);
  const total = Number(countRes[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / params.limit));

  return { articles: articlesDto, total, page: params.page, limit: params.limit, totalPages };
}

B) Исправить storage.getArticles() (или удалить, если не используется)

Поменять const countQuery на let countQuery

Аналогично убрать множественные .where() — собрать условия и применить разово

Если метод нигде не используется — лучше удалить, чтобы не держать баги.

C) Удалить из listArticles мусорные поля

Убрать categorySlug и publicationType из сигнатуры и из routes — это сейчас только путает.

Мой вывод “в двух словах”

Qoder сделал прогресс, но листинг статей сейчас реально неверный:

фильтры и поиск могут работать случайно из-за .where() перетирания,

getArticles() может ломать сборку из-за reassignment const,

выдача не соответствует тому, что нужно фронту (author/tags/isReadLater).

Если хочешь — я следующим шагом точечно проверю твой ArticlesPage.tsx (он у тебя лежит в /mnt/data/ArticlesPage.tsx) и скажу, какие поля он сейчас ждёт и нужно ли что-то поправить после изменения DTO.

Давай
Думал на протяжении 4 секунд

Давай. Я могу прямо сейчас сделать проверку/чеклист для ArticlesPage.tsx под “правильный” DTO (author/tags/isReadLater/views), но есть нюанс: сам файл ArticlesPage.tsx, который ты загружал раньше, у меня уже истёк (система сообщает, что часть файлов больше недоступна). Поэтому я не вижу текущую реализацию построчно.

✅ Что я могу сделать без файла: дать точные требования к UI/типам/рендеру/запросу, чтобы Qoder поправил “как надо”.
✅ Если хочешь, чтобы я дал построчные правки, просто перезагрузи ArticlesPage.tsx — и я пройдусь по коду конкретно.

Чеклист “как должен выглядеть ArticlesPage.tsx” после фикса listArticles()
1) Ожидаемый ответ API

GET /api/articles?... должен возвращать:

{
  articles: ArticleCardDTO[],
  total: number,
  page: number,
  limit: number,
  totalPages: number
}


Где ArticleCardDTO (минимум для ленты):

type ArticleCardDTO = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  section: string | null;
  format: string | null;
  lang: string;
  views: number;
  commentsCount: number;
  createdAt: string;        // ISO или Date (но лучше ISO)
  publishedAt: string | null;

  author?: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };

  tags: Array<{ id?: string; axis?: string; name: string; slug: string }>;
  isReadLater?: boolean;
};


⚠️ Важно: больше никаких viewCount, только views.

2) Правильный fetch + state

ArticlesPage.tsx должен делать запрос с query params (а не фильтровать локально):

search (строка)

section

format

sort → маппить в sortBy на сервере ("new" | "popular" или сразу views/publishedAt)

page, limit

Пример:

const qs = new URLSearchParams();
if (search) qs.set("search", search);
if (section) qs.set("section", section);
if (format) qs.set("format", format);
qs.set("sortBy", sortBy);        // "publishedAt" | "views"
qs.set("sortOrder", "desc");
qs.set("page", String(page));
qs.set("limit", String(limit));

const res = await fetch(`/api/articles?${qs.toString()}`);
const data = await res.json();
setArticles(data.articles);
setTotalPages(data.totalPages);

3) Рендер карточки без “undefined”

На карточке безопасно показываем:

Заголовок + excerpt

Автор: article.author?.fullName ?? article.author?.username ?? "—"

Теги: article.tags?.slice(0, 4) (и “+N” если больше)

Счётчики: views, commentsCount

Флажок “читать позже”: article.isReadLater === true

Пример отображения автора:

<span>
  {article.author?.fullName || article.author?.username || "Reader"}
</span>

4) Кнопка “Читать позже” в ленте

Если вы хотите прям в ленте:

POST /api/articles/:id/read-later

DELETE /api/articles/:id/read-later

После клика — оптимистично поменять isReadLater в состоянии:

setArticles(prev => prev.map(a => a.id === id ? { ...a, isReadLater: !a.isReadLater } : a));


И потом уже сделать запрос.

5) Навигация на детальную

Открытие статьи по slug:

<Link to={`/articles/${article.slug}`}>...</Link>

6) Убрать мусорные поля

Если в ArticlesPage.tsx ещё есть ссылки на:

publicationType

categorySlug

replyTo/repliesCount

viewCount

— их надо выкинуть.

Что я рекомендую сделать “лучшим вариантом” (чтобы больше не разъезжалось)

Сделайте один helper в storage.ts:

toArticleCardDTO(rows, tagsMap, readLaterSet)

И используйте его и для ленты, и для похожих списков (например read-later). Тогда контракт будет одинаковым.

Чтобы я дал построчные правки прямо по вашему файлу

Перезагрузи, пожалуйста, /mnt/data/ArticlesPage.tsx (или сам файл ArticlesPage.tsx сюда).
Тогда я:

покажу конкретно где и что заменить,

какие поля у вас сейчас ожидаются,

и что именно ломает UI.

(Файлы schema.ts / routes.ts / storage.ts я уже вижу — с ними ок.)