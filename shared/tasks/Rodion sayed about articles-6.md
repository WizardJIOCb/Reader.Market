Посмотрел текущие schema.ts, routes.ts, storage.ts (которые ты загрузил). В целом — Qoder уже сделал большую часть “каркаса” правильно, но главная причина, почему “всё ещё не то” — это /api/articles (листинг).

Сейчас у вас:

Detail (GET /api/articles/:identifier) отдаёт { article } и берёт storage.getArticle() → там уже есть author, tags, attachedBooks, isReadLater ✅

List (GET /api/articles) отдаёт результат storage.listArticles() → а вот он сейчас возвращает плоские поля (username/fullName/avatarUrl на верхнем уровне) и вообще не возвращает tags / isReadLater, плюс ещё есть важный баг с where() (ниже) ❌

Из-за этого лента выглядит “кривой”: фронт обычно ждёт author: {…} и tags: [], а получает другое.

Что точно нужно поправить (и это будет “лучший вариант”)
1) Критичный баг в storage.listArticles(): .where() затирает условия

В Drizzle .where() не добавляет, а заменяет условие.
У вас сейчас:

query = query.where(publishedCondition);
...
query = query.where(eq(articles.section, params.section));
...
query = query.where(searchCondition);


➡️ В итоге остается только последнее where, а publishedCondition легко теряется.

Надо собрать условия в массив и применить один раз через and(...).

2) storage.listArticles() должен отдавать DTO как в detail: author, tags, isReadLater

Сейчас list возвращает записи без тегов и без вложенного автора, но фронт/UX подразумевает именно так.

3) Параметры categorySlug/publicationType в listArticles — мусор

У вас они в сигнатуре есть, но логики уже нет. Лучше убрать, чтобы не плодить “призраки”.

Готовый патч для Qoder: переписать storage.listArticles() нормально

Ниже — готовая версия listArticles() под вашу текущую схему (articles/users/articleTagLinks/articleTags/articleReadLater уже импортируются у вас в storage.ts).
Qoder может просто заменить тело метода.

✅ Вставить в server/storage.ts вместо текущего async listArticles(...) { ... }
async listArticles(params: {
  page: number;
  limit: number;
  section?: string;
  format?: string;
  searchQuery?: string;
  sortBy: "publishedAt" | "createdAt" | "views";
  sortOrder: "asc" | "desc";
  userId?: string;
}): Promise<{ articles: any[]; total: number; page: number; limit: number; totalPages: number }> {
  const offset = (params.page - 1) * params.limit;

  // 1) Собираем условия корректно (where НЕ должен перетираться)
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

  // 2) Сортировка
  let sortColumn: any;
  switch (params.sortBy) {
    case "publishedAt":
      sortColumn = articles.publishedAt;
      break;
    case "views":
      sortColumn = articles.views;
      break;
    default:
      sortColumn = articles.createdAt;
  }

  // 3) Берём базовые статьи + автора (плоско), потом соберём DTO
  const baseRows = await db
    .select({
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
    .orderBy(params.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn))
    .limit(params.limit)
    .offset(offset);

  const articleIds = baseRows.map(r => r.id);

  // 4) Батч: теги
  const tagsByArticleId = new Map<string, any[]>();
  if (articleIds.length) {
    const tagRows = await db
      .select({
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

  // 5) Батч: isReadLater
  let readLaterSet: Set<string> | null = null;
  if (params.userId && articleIds.length) {
    const rlRows = await db
      .select({ articleId: articleReadLater.articleId })
      .from(articleReadLater)
      .where(and(
        eq(articleReadLater.userId, params.userId),
        inArray(articleReadLater.articleId, articleIds)
      ));

    readLaterSet = new Set(rlRows.map(r => r.articleId));
  }

  // 6) Собираем DTO “как в детальной”
  const dto = baseRows.map(r => ({
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

  // 7) total
  const countResult = await db
    .select({ count: count() })
    .from(articles)
    .where(where);

  const total = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / params.limit));

  return { articles: dto, total, page: params.page, limit: params.limit, totalPages };
}

Пара мелких правок, чтобы “не возвращалось старое”
server/routes.ts (листинг)

У вас сейчас всё ок, но я бы ещё унифицировал query param:

сейчас вы читаете search → кладёте в searchQuery. Ок.

главное: ничего не менять, после патча listArticles фронт уже начнет получать author/tags.

Итоговая оценка

После этой правки:

лента /articles станет выглядеть как ожидается продуктово (автор, теги, “читать позже”),

фильтры/поиск перестанут “чудить” из-за перетирания .where(),

вы приблизитесь к одному контракту между list и detail (это ключ).