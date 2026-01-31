В целом Qoder уже почти попал, но твоё ощущение “не то” сейчас идёт из одного конкретного косяка в листинге + пары мелких “риск-багов”.

✅ Что стало реально хорошо

/api/articles/:identifier → возвращает { article } (OK)

/api/articles/:id (PUT) → возвращает { article } (OK)

listArticles() уже делает батч тегов + батч read-later и пытается формировать DTO “как в detail” — это правильное направление

create/update уже умеют attachTagsToArticle() и attachBooksToArticle() — супер

❌ Что всё ещё “не то” (и почему лента будет кривой)
1) В storage.listArticles() сломана сборка/автор всегда пустой

Ты в select не выбираешь authorId, но ниже в DTO делаешь:

author: r.authorId ? { ... } : undefined


А в запросе сейчас есть только:

username, fullName, avatarUrl


без authorId: users.id.

➡️ Итог: author будет всегда undefined (или TS вообще ругнётся, если типы строгие). Это ровно то “ощущение не то” в ленте.

Что передать Qoder:
в listArticles() добавить поле в select:

authorId: users.id,


и оставить DTO как есть.

2) В listArticles() поиск не использует searchText

Сейчас поиск только по title и excerpt:

ilike(articles.title, ...),
ilike(articles.excerpt, ...)


Но ты же уже завёл searchText в схеме — логично включить его, иначе поиск “кажется слабым/сломанным”.

Что передать Qoder:
добавить:

ilike(articles.searchText, `%${params.searchQuery}%`)

3) Риск падения на count() из-за BigInt

count() в Postgres часто возвращает bigint. Сейчас у тебя:

const total = countResult[0]?.count || 0;
const totalPages = Math.ceil(total / params.limit);


Если total будет BigInt — деление на number может упасть в рантайме.

Что передать Qoder:
жёстко привести к Number:

const total = Number(countResult[0]?.count ?? 0);
const totalPages = Math.max(1, Math.ceil(total / params.limit));

📌 Что именно написать Qoder (коротко, по делу)

Скопируй ему:

“В server/storage.ts в listArticles() осталось 3 must-fix:

В select добавить authorId: users.id, потому что DTO проверяет r.authorId, а сейчас его нет → author всегда undefined.

В searchCondition добавить ilike(articles.searchText, ...), иначе поиск слабый.

count() привести к Number, иначе возможен BigInt runtime error: const total = Number(countResult[0]?.count ?? 0) и totalPages = Math.max(1, Math.ceil(total / limit)).”

Бонус (не критично, но улучшит “ощущение качества”)

В listArticles() ты выбираешь contentJson и searchText в листинг — это лишнее для карточек (тяжелее ответ). Лучше убрать из select и оставлять это только в detail.

Если хочешь, следующим шагом я могу:

быстро проверить фронт-ленту (ArticlesPage.tsx) на соответствие полям (views/commentsCount/author/tags/isReadLater) — но файл надо перезалить (старый у меня уже недоступен).

ArticlesPage.tsx
TypeScript
Давай
Думал на протяжении 29s

Посмотрел ArticlesPage.tsx (который ты залил). Да, здесь есть несколько вещей, из-за которых “ощущается не то” — и это реальные баги, а не вкусовщина.

Критично: пагинация сейчас фактически сломана
1) useEffect НЕ зависит от currentPage

Ты меняешь страницу кнопками Next/Previous, но loadArticles() не запускается, потому что зависимости эффекта — только [searchQuery, selectedCategory].

➡️ Итог: нажал “Next” → currentPage поменялся, а запрос на сервер не ушёл.

2) Ты сбрасываешь currentPage в 1 и сразу же делаешь fetch со старым currentPage

Внутри эффекта:

setCurrentPage(1);
loadArticles();


loadArticles() использует currentPage из замыкания (старое значение), так что при смене фильтра/поиска он может сходить за страницей 3, а потом UI покажет Page 1.

✅ Как правильно (лучший вариант): два эффекта

один сбрасывает страницу при смене фильтров

второй грузит данные при смене страницы или фильтров

Пример патча (можно отдать Qoder):

// 1) Сбрасываем страницу при смене фильтров/поиска
useEffect(() => {
  setCurrentPage(1);
}, [searchQuery, selectedCategory]);

// 2) Грузим статьи при смене page/filters
useEffect(() => {
  const loadArticles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: "12",
      });
      if (searchQuery) params.set("search", searchQuery);
      if (selectedCategory) params.set("section", selectedCategory);

      const response = await fetch(`/api/articles?${params.toString()}`, {
        headers: user ? { Authorization: `Bearer ${localStorage.getItem("authToken")}` } : undefined,
      });

      const data = await response.json();
      setArticles(data.articles || []);
      setTotalPages(data.totalPages || 1);
      setTotalArticles(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  loadArticles();
}, [currentPage, searchQuery, selectedCategory, user]);

Критично: UI может падать, если author не пришёл

Сейчас ты без проверок используешь:

article.author.avatarUrl
article.author.username.charAt(0)


Если на бэке где-то автор не подцепился/не сериализовался (что у вас уже случалось), страница упадёт.

✅ Минимальный safe-guard:

const authorName = article.author?.fullName || article.author?.username || "Reader";
const authorInitial = (article.author?.username || authorName).charAt(0).toUpperCase();


И в JSX:

{article.author?.avatarUrl ? (...) : (...)}
<span>by {authorName}</span>

Логическая ошибка в фильтрах: две одинаковые кнопки “All…”

Сейчас у тебя две кнопки, которые делают одно и то же:

allCategories

allSections

Обе:

onClick={() => setSelectedCategory(null)}

и даже variant одинаковый

➡️ Это выглядит как баг интерфейса.

✅ Убрать одну из них (оставить одну “Все”).

UX/доступ: “Создать статью” сейчас показывается всем

Кнопка:

<Button asChild>
  <Link href="/articles/new">...</Link>
</Button>


показывается даже без user. Если создавать статьи должны только авторизованные (как мы и договаривались), то:

{user && (
  <Button asChild>
    <Link href="/articles/new">...</Link>
  </Button>
)}


Если хотите “создать можно всем” — ок, но тогда бэк должен отдавать понятную ошибку/редирект на логин, иначе будет “почему не сохраняется”.

Мелочи, но улучшают ощущение качества

MessageCircle импортирован, но не используется.

totalArticles нигде не показывается — можно вывести “Найдено N” рядом с фильтрами/поиском.

Сейчас фильтр только по section; format не используется — либо убрать из UI, либо добавить ещё один фильтр.

Что передать Qoder одним сообщением

Можешь прям так отправить:

В ArticlesPage.tsx исправить пагинацию: useEffect должен зависеть от currentPage, а сброс страницы на 1 при смене фильтров вынести в отдельный эффект.

Убрать вторую кнопку allSections (дубль allCategories).

Сделать безопасный рендер автора через optional chaining (article.author?.…), чтобы не падало.

Кнопку “Создать статью” показывать только авторизованным (если так задумано).

Если хочешь, я также могу глянуть рядом ReadLaterPage.tsx и ArticleDetailPage.tsx на такие же “контрактные” баги (обычно они идут пачкой).

ArticleDetailPage.tsx
TypeScript
ReadLaterPage.tsx
TypeScript
Да вот они
Думал на протяжении 31s

Посмотрел оба файла. Да, тут есть несколько вещей, из-за которых и правда “не то” ощущается — причём это не про дизайн, а про контракт API/роутинга/авторизации и пару реальных багов в логике.

Ниже — конкретно по каждому файлу и что лучше сказать Qoder (я сразу даю “лучший вариант”, без развилок).

✅ ArticleDetailPage.tsx — что не так и как исправить
1) Состояние “Сохранено” (Read Later) никогда не инициализируется

Ты делаешь const [isSaved, setIsSaved] = useState(false);, но после загрузки статьи не выставляешь isSaved из article.isReadLater.

Из-за этого:

кнопка “Сохранить” всегда выглядит как не сохранённая,

даже если API уже возвращает isReadLater.

✅ Правка: после setArticle(article) сразу:

setIsSaved(!!article.isReadLater);


(и желательно делать это и при каждом обновлении article)

2) Потенциальный крэш, если author/tags/attachedBooks внезапно не пришли

Сейчас код жёстко обращается к:

article.author.username

article.tags.length

article.attachedBooks.length

Если из-за бага в бэке/миграциях/DTO это поле будет undefined, страница упадёт.

✅ Лучший вариант: на уровне данных сразу нормализовать:

const normalized = {
  ...article,
  tags: article.tags ?? [],
  attachedBooks: article.attachedBooks ?? [],
  author: article.author ?? { id: "", username: "Reader", fullName: null, avatarUrl: null },
};
setArticle(normalized);
setIsSaved(!!normalized.isReadLater);


И в JSX делать article.author?.username и т.п.

3) Разный ключ токена (см. ReadLaterPage ниже)

Тут ты используешь localStorage.getItem('authToken'), а в ReadLaterPage — token. Это приведёт к “в одном месте работает, в другом нет”.

✅ Привести везде к одному: authToken.

4) Роут редактирования

Кнопка редактирования ведёт на:

<Link href={`/articles/${article.slug}/edit`}>


Убедись, что у вас реально есть такой роут. В вашем редакторе ранее встречалось /articles/:slug/edit — тогда всё ок.

✅ ReadLaterPage.tsx — тут багов больше, именно из-за них “не то”
1) Неправильный ключ токена

Сейчас:

Authorization: `Bearer ${localStorage.getItem('token')}`


Но в остальных местах у вас authToken.
➡️ В итоге запросы read-later часто будут 401 и страница будет казаться “сломалась”.

✅ Исправить на:

Authorization: `Bearer ${localStorage.getItem('authToken')}`

2) Неправильный проп для Link (wouter)

В проекте ты уже используешь:

<Link href="/articles">


А тут:

<Link to="/articles">


В wouter корректный проп — href (у тебя же в остальных файлах так).
➡️ Навигация может не работать/работать нестабильно.

✅ Везде заменить to= на href=.

3) Ссылки на статьи построены по id, а у вас статьи открываются по slug

Сейчас:

<Link to={`/articles/${article.id}`}>


Но ArticleDetailPage и роуты фактически работают по slug (/api/articles/${slug} и страница по slug).
➡️ Из ReadLater ты будешь попадать на несуществующую страницу.

✅ Нужно чтобы read-later API возвращал slug, и тут строить:

<Link href={`/articles/${article.slug}`}>


Для этого:

добавить slug: string в интерфейс Article на ReadLaterPage

и в бэке getUserReadLaterArticles() возвращать slug

4) Ты используешь устаревшие поля: viewCount, category

Сейчас в интерфейсе:

category?: { name, nameRu, color }
viewCount: number


Но ваша новая модель — section/format, и счётчик — views.

✅ Привести под новую модель:

заменить viewCount → views

category убрать и (если надо) показывать section / format бейджами

5) Пагинация “задумана”, но не реализована

Есть page, hasMore, но:

loadArticles() вызывается один раз,

page никогда не увеличивается,

UI “Load more” отсутствует.

✅ Лучший вариант:

либо убрать пагинацию (просто грузить первые 50),

либо сделать кнопку “Загрузить ещё”:

<Button onClick={() => setPage(p => p + 1)} disabled={!hasMore || loading}>Load more</Button>


и эффект:

useEffect(() => { loadArticles(); }, [page]);


(и не забыть не дублировать список при page=1: на page=1 делать replace, на page>1 append)

Что передать Qoder одним сообщением

Можешь просто скопировать:

“Проверь и поправь ArticleDetailPage.tsx и ReadLaterPage.tsx:

ArticleDetailPage.tsx: после загрузки статьи выставлять isSaved из article.isReadLater (setIsSaved(!!article.isReadLater)), и подстраховать author/tags/attachedBooks (fallback пустые массивы/дефолтный author), чтобы не было падений.

ReadLaterPage.tsx: заменить localStorage.getItem('token') на 'authToken'.

ReadLaterPage.tsx: заменить <Link to=...> на <Link href=...> (как в остальных страницах).

ReadLaterPage.tsx: ссылки должны вести на /articles/${slug}, а не по id — добавить slug в ответ /api/articles/read-later и использовать его в ссылках.

ReadLaterPage.tsx: заменить legacy поля viewCount/category на актуальные views/section/format.

Либо убрать пагинацию, либо сделать её нормально: эффект по page + кнопка ‘Load more’.”**

Если хочешь, я могу ещё проверить, что именно сейчас возвращает /api/articles/read-later в routes.ts/storage.ts (там часто и есть первопричина “id vs slug”). Скажи — и я пробегусь по соответствующим методам в storage.ts и укажу точечные правки.

storage.ts
TypeScript
routes.ts
TypeScript
вот эти два файла
Думал на протяжении 50s

Посмотрел именно эти два файла: routes.ts и storage.ts.
Вывод: роуты в целом ок, а вот в storage.ts Qoder действительно не дожал — из-за этого лента “кажется кривой”, а местами могут быть тихие баги.

Ниже — конкретика и что передать Qoder (с готовыми правками).

✅ routes.ts — в целом нормально

/api/articles передаёт section/format/search/sortBy/sortOrder/userId → ок.

GET /api/articles/:identifier возвращает { article } → ок.

PUT/publish возвращают { article } → ок.

read-later endpoints совпадают с тем, что мы хотим (/read-later) → ок.

То есть “не то” сейчас не из-за routes.

❌ storage.ts — что реально не так
1) В listArticles() автор всегда будет undefined

В select ты НЕ выбираешь authorId: users.id, но ниже в DTO делаешь:

author: r.authorId ? { ... } : undefined


➡️ r.authorId не существует → автор пропадает (или TS ругнётся). Это ровно то, почему карточки выглядят “не так”.

✅ Фикс: добавить authorId: users.id в select.

2) Поиск не использует searchText

Сейчас searchCondition:

ilike(articles.title, `%q%`),
ilike(articles.excerpt, `%q%`)


А articles.searchText уже есть и даже выбирается.

✅ Фикс: добавить ilike(articles.searchText, %q%).

3) count() может быть BigInt → баг на пагинации

Ты делаешь:

const total = countResult[0]?.count || 0;
const totalPages = Math.ceil(total / params.limit);


count() в Postgres часто bigint → деление может упасть.

✅ Фикс: Number(...) и Math.max(1, ...).

4) Листинг таскает лишнее (contentJson, searchText)

Ты выбираешь contentJson и searchText в ленту, но UI карточкам это не нужно → тяжёлый ответ.

✅ Фикс: убрать их из select (оставить только для detail).

5) getUserReadLaterArticles() возвращает статьи без author/tags

Сейчас read-later отдаёт “голые” статьи (только поля articles.*).
А твой ReadLaterPage.tsx уже хочет показывать мета-инфу и ссылки по slug (slug там уже есть — это хорошо).

✅ Лучший вариант: сделать read-later таким же DTO как листинг (author + tags + isReadLater=true), чтобы UI не разваливался и не плодить 2 разных формата.

Что передать Qoder (готовые правки)
A) Починить listArticles() (4 фикса)

В storage.ts внутри listArticles в select добавить authorId и убрать лишнее:

Было:

username: users.username,
fullName: users.fullName,
avatarUrl: users.avatarUrl


Сделать так:

authorId: users.id,
username: users.username,
fullName: users.fullName,
avatarUrl: users.avatarUrl


И убрать из select:

contentJson: articles.contentJson,
searchText: articles.searchText,

Поиск: добавить searchText

Заменить блок searchCondition на:

const q = `%${params.searchQuery}%`;
const searchCondition = or(
  ilike(articles.title, q),
  ilike(articles.excerpt, q),
  ilike(articles.searchText, q)
);
conditions.push(searchCondition);

Count: привести к Number + totalPages >= 1

Заменить:

const total = countResult[0]?.count || 0;
const totalPages = Math.ceil(total / params.limit);


на:

const total = Number(countResult[0]?.count ?? 0);
const totalPages = Math.max(1, Math.ceil(total / params.limit));

B) Починить getUserReadLaterArticles() (лучший вариант)

Сейчас метод возвращает статьи без автора/тегов и тащит contentJson/searchText. Я бы сделал так же, как listArticles (author + tags), и сразу ставил isReadLater: true.

Минимальные правки:

Убрать из select:

contentJson, searchText


Добавить join users (как в listArticles), плюс authorId/users.*.

Подтянуть теги батчом по articleIds точно так же, как в listArticles().

Возвращать статьи в формате карточек:

{
  ...article,
  author: {...},
  tags: [...],
  isReadLater: true
}


И для total тоже сделать Number(...) (BigInt риск там тоже есть).

Коротко: почему “не то”

Лента сейчас теряет автора из-за отсутствующего authorId в select.

Поиск ощущается слабым, потому что не ищет по searchText.

Пагинация может глючить из-за BigInt count().

ReadLater и список статей в разных форматах, из-за чего UI постоянно “подкручивают костылями”.

Если хочешь — я могу прямо следующим сообщением:

написать точный готовый код для getUserReadLaterArticles() (полный метод) по образцу твоего listArticles(), чтобы Qoder просто вставил и всё заработало.

давай
Думал на протяжении 9s

Ок — даю готовый полный метод getUserReadLaterArticles() “по-взрослому”: он возвращает карточки в том же формате, что лента (author + tags + isReadLater), не тащит лишнее (contentJson/searchText), нормально считает total (без BigInt-падений) и поддерживает сортировку.

Нужно будет только подогнать названия импортов (если у вас они чуть иначе называются), но логика полностью рабочая.

✅ Полный метод getUserReadLaterArticles() (вставить в storage.ts)

Предполагается, что у вас уже есть импорты:
db, articles, users, articleReadLater, articleTagLinks, articleTags
и drizzle helpers: and, eq, inArray, asc, desc, count (и при желании ilike, or если хотите поиск)

async getUserReadLaterArticles(params: {
  userId: string;
  page: number;
  limit: number;
  sortBy?: "savedAt" | "publishedAt" | "createdAt" | "views";
  sortOrder?: "asc" | "desc";
}): Promise<{
  articles: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(1, params.limit ?? 12));
  const offset = (page - 1) * limit;

  const sortBy = params.sortBy ?? "savedAt";
  const sortOrder = params.sortOrder ?? "desc";

  // 1) Where: только статьи, которые есть в read-later у пользователя
  const where = eq(articleReadLater.userId, params.userId);

  // 2) OrderBy
  // savedAt = время добавления в read-later
  let sortColumn: any;
  switch (sortBy) {
    case "publishedAt":
      sortColumn = articles.publishedAt;
      break;
    case "createdAt":
      sortColumn = articles.createdAt;
      break;
    case "views":
      sortColumn = articles.views;
      break;
    case "savedAt":
    default:
      sortColumn = articleReadLater.createdAt;
      break;
  }

  const orderByExpr = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  // 3) Берём базовые строки: article + author + savedAt
  const rows = await db
    .select({
      // article fields (карточка)
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

      // author
      authorId: users.id,
      username: users.username,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,

      // read-later metadata
      savedAt: articleReadLater.createdAt,
    })
    .from(articleReadLater)
    .innerJoin(articles, eq(articles.id, articleReadLater.articleId))
    .leftJoin(users, eq(users.id, articles.authorUserId))
    .where(where)
    .orderBy(orderByExpr)
    .limit(limit)
    .offset(offset);

  const articleIds = rows.map(r => r.id);

  // 4) Батч: теги для всех articleIds
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

  // 5) DTO: как в ленте + isReadLater=true
  const dto = rows.map(r => ({
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

    author: r.authorId
      ? {
          id: r.authorId,
          username: r.username,
          fullName: r.fullName,
          avatarUrl: r.avatarUrl,
        }
      : undefined,

    tags: tagsByArticleId.get(r.id) ?? [],
    isReadLater: true,

    // можно вернуть savedAt, если хочешь показывать “добавлено тогда-то”
    savedAt: r.savedAt,
  }));

  // 6) total + totalPages (важно: count может быть bigint)
  const countRes = await db
    .select({ count: count() })
    .from(articleReadLater)
    .where(eq(articleReadLater.userId, params.userId));

  const total = Number(countRes[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return { articles: dto, total, page, limit, totalPages };
}

✅ Что ещё надо поправить в routes.ts под этот метод (если ещё не так)

Для /api/articles/read-later лучше явно прокидывать sortBy/sortOrder/page/limit, например:

sortBy=savedAt по умолчанию

sortOrder=desc

И возвращать:

res.json(result);

✅ И маленькая, но важная правка для фронта ReadLaterPage

После того как API возвращает DTO с slug, в ReadLaterPage.tsx ссылки должны быть:

<Link href={`/articles/${article.slug}`}>


и токен всегда authToken, не token.

Если хочешь — следующим шагом я дам такой же “готовый метод” для listArticles() (если Qoder опять “не так” сделает) с учётом ваших текущих полей и чтобы author/tags/isReadLater были единообразны везде.

Давай
Думал на протяжении пары секунд

Ок — даю готовый “лучший” метод listArticles() (в том же стиле, как я сделал getUserReadLaterArticles()), чтобы:

фильтры/поиск работали корректно (один where(and(...)), без перетирания)

возвращался нормальный DTO для ленты: author (вложенный), tags, isReadLater

views (не viewCount)

count() безопасно приводился к Number (без BigInt-грабель)

не тащились лишние поля (contentJson, searchText) в карточки

Нужно будет только подогнать имена импортов (если у вас они чуть иначе называются), но логика полностью готова.

✅ Полный метод listArticles() (вставить в storage.ts)
async listArticles(params: {
  page: number;
  limit: number;

  section?: string;
  format?: string;
  searchQuery?: string;

  sortBy: "publishedAt" | "createdAt" | "views";
  sortOrder: "asc" | "desc";

  userId?: string;
}): Promise<{
  articles: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(1, params.limit ?? 12));
  const offset = (page - 1) * limit;

  // 1) Условия (важно: where не должен перетираться)
  const conditions: any[] = [eq(articles.status, "published")];

  if (params.section) conditions.push(eq(articles.section, params.section));
  if (params.format) conditions.push(eq(articles.format, params.format));

  if (params.searchQuery?.trim()) {
    const q = `%${params.searchQuery.trim()}%`;
    conditions.push(
      or(
        ilike(articles.title, q),
        ilike(articles.excerpt, q),
        ilike(articles.searchText, q),
      )
    );
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

  const orderByExpr = params.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  // 3) Базовый список: article + author (без тяжёлых полей)
  const rows = await db
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

      // author (ВАЖНО: берем id, иначе author всегда undefined)
      authorId: users.id,
      username: users.username,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
    })
    .from(articles)
    .leftJoin(users, eq(users.id, articles.authorUserId))
    .where(where)
    .orderBy(orderByExpr)
    .limit(limit)
    .offset(offset);

  const articleIds = rows.map(r => r.id);

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
      .where(
        and(
          eq(articleReadLater.userId, params.userId),
          inArray(articleReadLater.articleId, articleIds)
        )
      );

    readLaterSet = new Set(rlRows.map(r => r.articleId));
  }

  // 6) DTO: ровно то, что нужно фронту (author + tags + isReadLater)
  const dto = rows.map(r => ({
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

    author: r.authorId
      ? {
          id: r.authorId,
          username: r.username,
          fullName: r.fullName,
          avatarUrl: r.avatarUrl,
        }
      : undefined,

    tags: tagsByArticleId.get(r.id) ?? [],
    isReadLater: readLaterSet ? readLaterSet.has(r.id) : undefined,
  }));

  // 7) total + totalPages (count может быть bigint)
  const countRes = await db
    .select({ count: count() })
    .from(articles)
    .where(where);

  const total = Number(countRes[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return { articles: dto, total, page, limit, totalPages };
}

Что обязательно синхронизировать в routes.ts

Убедись, что GET /api/articles передаёт в listArticles():

searchQuery из req.query.search

section, format

sortBy (по умолчанию "publishedAt") и sortOrder (по умолчанию "desc")

userId (если optionalAuthenticateToken)

И возвращает результат напрямую:

res.json(result);

Почему это “лучший вариант”

один контракт для фронта: author/tags/isReadLater всегда есть

фильтры/поиск не “случайные”

нет лишнего веса ответа

нет BigInt сюрпризов

Если хочешь — следующим шагом я дам такой же готовый метод для getArticlesByBook(bookId) (вкладка “Статьи по книге”) в том же формате DTO, чтобы всё было единообразно.

Давай
Думал на протяжении пары секунд

Ок — даю “лучший” вариант getArticlesByBook(bookId) в том же стиле DTO, что и listArticles() / getUserReadLaterArticles(): с author, tags, isReadLater, нормальной сортировкой и без лишних полей.

Важно: я сейчас не вижу ваш актуальный shared/schema.ts/таблицу article_books, потому что часть ранее загруженных файлов истекла (система так и сообщает). Если у вас таблица называется не articleBooks или поля отличаются (articleId/bookId/role/sortOrder) — Qoder подгонит имена импортов за минуту.

✅ Метод getArticlesByBook(bookId) (вставить в storage.ts)

Предполагаемые таблицы/поля:

articleBooks (связка): articleId, bookId, role, sortOrder

articles, users, articleTagLinks, articleTags, articleReadLater

статья должна быть status='published' (для публичной вкладки)

async getArticlesByBook(params: {
  bookId: string;
  page: number;
  limit: number;
  role?: "primary" | "in_list" | "mentioned"; // optional filter
  sortBy?: "publishedAt" | "createdAt" | "views" | "sortOrder"; // sortOrder = порядок в article_books
  sortOrder?: "asc" | "desc";
  userId?: string;
}): Promise<{
  articles: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(1, params.limit ?? 12));
  const offset = (page - 1) * limit;

  const sortBy = params.sortBy ?? "publishedAt";
  const sortOrder = params.sortOrder ?? "desc";

  // 1) where: только связанные с bookId + опубликованные
  const conditions: any[] = [
    eq(articleBooks.bookId, params.bookId),
    eq(articles.status, "published"),
  ];

  if (params.role) conditions.push(eq(articleBooks.role, params.role));

  const where = and(...conditions);

  // 2) orderBy
  let sortColumn: any;
  switch (sortBy) {
    case "views":
      sortColumn = articles.views;
      break;
    case "createdAt":
      sortColumn = articles.createdAt;
      break;
    case "sortOrder":
      sortColumn = articleBooks.sortOrder;
      break;
    case "publishedAt":
    default:
      sortColumn = articles.publishedAt;
      break;
  }

  const orderByExpr = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  // 3) base rows: join article_books -> articles -> users
  const rows = await db
    .select({
      // article fields
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

      // author
      authorId: users.id,
      username: users.username,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,

      // link metadata (иногда полезно на UI)
      linkRole: articleBooks.role,
      linkSortOrder: articleBooks.sortOrder,
    })
    .from(articleBooks)
    .innerJoin(articles, eq(articles.id, articleBooks.articleId))
    .leftJoin(users, eq(users.id, articles.authorUserId))
    .where(where)
    .orderBy(orderByExpr)
    .limit(limit)
    .offset(offset);

  const articleIds = rows.map(r => r.id);

  // 4) tags batch
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

  // 5) isReadLater batch
  let readLaterSet: Set<string> | null = null;
  if (params.userId && articleIds.length) {
    const rlRows = await db
      .select({ articleId: articleReadLater.articleId })
      .from(articleReadLater)
      .where(
        and(
          eq(articleReadLater.userId, params.userId),
          inArray(articleReadLater.articleId, articleIds)
        )
      );
    readLaterSet = new Set(rlRows.map(r => r.articleId));
  }

  // 6) dto
  const dto = rows.map(r => ({
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

    author: r.authorId
      ? {
          id: r.authorId,
          username: r.username,
          fullName: r.fullName,
          avatarUrl: r.avatarUrl,
        }
      : undefined,

    tags: tagsByArticleId.get(r.id) ?? [],
    isReadLater: readLaterSet ? readLaterSet.has(r.id) : undefined,

    // мета связи с книгой (по желанию UI)
    bookLink: {
      role: r.linkRole,
      sortOrder: r.linkSortOrder,
    },
  }));

  // 7) total
  const countRes = await db
    .select({ count: count() })
    .from(articleBooks)
    .innerJoin(articles, eq(articles.id, articleBooks.articleId))
    .where(where);

  const total = Number(countRes[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return { articles: dto, total, page, limit, totalPages };
}

✅ Роут для книги (добавить в routes.ts)

Если у вас ещё нет:

app.get("/api/books/:bookId/articles", optionalAuthenticateToken, async (req, res) => {
  const userId = req.user?.id;
  const { bookId } = req.params;

  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 12;

  const role = req.query.role as any; // primary/in_list/mentioned
  const sortBy = (req.query.sortBy as any) ?? "publishedAt";
  const sortOrder = (req.query.sortOrder as any) ?? "desc";

  const result = await storage.getArticlesByBook({
    bookId,
    page,
    limit,
    role,
    sortBy,
    sortOrder,
    userId,
  });

  res.json(result);
});

UI-совет для вкладки “Статьи” на странице книги

по умолчанию sortBy=publishedAt desc

фильтр по роли: All / Primary / In lists / Mentioned

при role=in_list можно сортировать sortBy=sortOrder asc (если хочется, чтобы подборка была в “порядке автора статьи”).

Если хочешь, скинь актуальную схему/таблицу связки (article_books) ещё раз (или только её кусок), и я подгоню код под точные имена полей/таблицы, чтобы Qoder мог вставить без ручных правок.

Давай
Думал на протяжении 6s

Ок, давай — но сразу скажу: часть файлов, которые ты загружал раньше, у меня уже истекла, поэтому я не могу “в ноль” подогнать код под точные имена колонок вашей article_books.
Зато я дам готовый best-practice вариант, который Qoder сможет вставить сразу, и короткую “таблицу соответствий” — под любой из двух типичных вариантов схемы (с id или с composite PK).

Ниже — что именно сделать + 2 версии метода getArticlesByBook (выбирайте ту, которая совпадает с вашей таблицей).

0) Что должно получиться

Backend: GET /api/books/:bookId/articles

Storage: getArticlesByBook() возвращает карточки в формате ленты: author, tags, isReadLater, views, commentsCount, slug (и по желанию bookLink.role/sortOrder).

Frontend: вкладка “Статьи” на странице книги отображает список и фильтр по роли.

1) Таблица соответствий для Qoder
Вариант A — связка без id, с уникальным ключом (чаще всего)

article_books:

article_id (uuid) → в Drizzle articleId

book_id (uuid) → bookId

role (text/enum) → role

sort_order (int) → sortOrder

Вариант B — связка с id

article_books:

id (uuid) → id

article_id → articleId

book_id → bookId

role → role

sort_order → sortOrder

Обе схемы одинаково подходят для getArticlesByBook(). Отличие только в том, есть ли id.

2) Роут в routes.ts (вставить как есть)
app.get("/api/books/:bookId/articles", optionalAuthenticateToken, async (req, res) => {
  const userId = req.user?.id;
  const { bookId } = req.params;

  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 12;

  const role = req.query.role as any; // "primary" | "in_list" | "mentioned"
  const sortBy = (req.query.sortBy as any) ?? "publishedAt"; // publishedAt|createdAt|views|sortOrder
  const sortOrder = (req.query.sortOrder as any) ?? "desc";

  const result = await storage.getArticlesByBook({
    bookId,
    page,
    limit,
    role,
    sortBy,
    sortOrder,
    userId,
  });

  res.json(result);
});

3) Storage: “лучший” getArticlesByBook() (унифицированный DTO)

Qoder’у нужно только подогнать имена импортов таблиц: articleBooks / articleTagLinks / articleTags / articleReadLater.

async getArticlesByBook(params: {
  bookId: string;
  page: number;
  limit: number;
  role?: "primary" | "in_list" | "mentioned";
  sortBy?: "publishedAt" | "createdAt" | "views" | "sortOrder";
  sortOrder?: "asc" | "desc";
  userId?: string;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(1, params.limit ?? 12));
  const offset = (page - 1) * limit;

  const sortBy = params.sortBy ?? "publishedAt";
  const sortOrder = params.sortOrder ?? "desc";

  const conditions: any[] = [
    eq(articleBooks.bookId, params.bookId),
    eq(articles.status, "published"),
  ];
  if (params.role) conditions.push(eq(articleBooks.role, params.role));

  const where = and(...conditions);

  let sortColumn: any;
  switch (sortBy) {
    case "views":
      sortColumn = articles.views;
      break;
    case "createdAt":
      sortColumn = articles.createdAt;
      break;
    case "sortOrder":
      sortColumn = articleBooks.sortOrder;
      break;
    case "publishedAt":
    default:
      sortColumn = articles.publishedAt;
      break;
  }

  const orderByExpr = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  // 1) Base rows: article_books -> articles -> users
  const rows = await db
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

      linkRole: articleBooks.role,
      linkSortOrder: articleBooks.sortOrder,
    })
    .from(articleBooks)
    .innerJoin(articles, eq(articles.id, articleBooks.articleId))
    .leftJoin(users, eq(users.id, articles.authorUserId))
    .where(where)
    .orderBy(orderByExpr)
    .limit(limit)
    .offset(offset);

  const articleIds = rows.map(r => r.id);

  // 2) Tags batch
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

  // 3) isReadLater batch
  let readLaterSet: Set<string> | null = null;
  if (params.userId && articleIds.length) {
    const rlRows = await db
      .select({ articleId: articleReadLater.articleId })
      .from(articleReadLater)
      .where(
        and(
          eq(articleReadLater.userId, params.userId),
          inArray(articleReadLater.articleId, articleIds)
        )
      );

    readLaterSet = new Set(rlRows.map(r => r.articleId));
  }

  // 4) DTO
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

    author: r.authorId
      ? { id: r.authorId, username: r.username, fullName: r.fullName, avatarUrl: r.avatarUrl }
      : undefined,

    tags: tagsByArticleId.get(r.id) ?? [],
    isReadLater: readLaterSet ? readLaterSet.has(r.id) : undefined,

    bookLink: { role: r.linkRole, sortOrder: r.linkSortOrder },
  }));

  // 5) Count (важно: Number(...) из-за bigint)
  const countRes = await db
    .select({ count: count() })
    .from(articleBooks)
    .innerJoin(articles, eq(articles.id, articleBooks.articleId))
    .where(where);

  const total = Number(countRes[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return { articles: articlesDto, total, page, limit, totalPages };
}

4) Что надо добавить в UI вкладку книги (коротко)

запрос: /api/books/${bookId}/articles?page=1&limit=12&role=...&sortBy=publishedAt&sortOrder=desc

сортировки:

default: publishedAt desc

если role=in_list: можно sortBy=sortOrder asc (чтобы порядок в подборке совпал)

Чтобы я сделал “вставить без правок вообще”

Если хочешь, чтобы я подогнал всё 1-в-1 под вашу реальную схему article_books, просто перезалей schema.ts (или кусок, где articleBooks описан). Тогда я напишу точную версию с вашими именами полей и без “подгоните импорты”.

schema.ts
TypeScript
Думал на протяжении 38s

Отлично — теперь с твоим актуальным schema.ts можно подогнать в ноль под реальные имена таблиц/полей. У тебя как раз “идеальный” вариант:

articleBooks = article_books с id, articleId, bookId, role, sortOrder

articleTagLinks = article_tag_links с articleId, tagId

articleTags = article_tags с axis/name/slug

articleReadLater = article_read_later с userId/articleId/createdAt

articles содержит views/commentsCount/slug/section/format/status/publishedAt и т.д.

Ниже — готовый код, который Qoder может вставить без “угадываний”.

1) Route: GET /api/books/:bookId/articles (в routes.ts)

Добавь (или если уже есть — приведи к такому виду):

app.get("/api/books/:bookId/articles", optionalAuthenticateToken, async (req, res) => {
  const userId = req.user?.id;
  const { bookId } = req.params;

  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 12;

  const role = req.query.role ? String(req.query.role) : undefined; // primary|in_list|mentioned
  const sortBy = (req.query.sortBy ? String(req.query.sortBy) : "publishedAt") as
    | "publishedAt"
    | "createdAt"
    | "views"
    | "sortOrder";

  const sortOrder = (req.query.sortOrder ? String(req.query.sortOrder) : "desc") as "asc" | "desc";

  const result = await storage.getArticlesByBook({
    bookId,
    page,
    limit,
    role: role as any,
    sortBy,
    sortOrder,
    userId,
  });

  res.json(result);
});

2) Storage: getArticlesByBook() (в storage.ts)
Импорты (если вдруг не хватает)
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { count } from "drizzle-orm";
import { db } from "./db";
import { articles, users, articleBooks, articleTags, articleTagLinks, articleReadLater } from "../shared/schema";

Сам метод (копипаст)
async getArticlesByBook(params: {
  bookId: string;
  page: number;
  limit: number;
  role?: "primary" | "in_list" | "mentioned";
  sortBy?: "publishedAt" | "createdAt" | "views" | "sortOrder";
  sortOrder?: "asc" | "desc";
  userId?: string;
}): Promise<{
  articles: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(1, params.limit ?? 12));
  const offset = (page - 1) * limit;

  const sortBy = params.sortBy ?? "publishedAt";
  const sortOrder = params.sortOrder ?? "desc";

  // 1) where: связка с книгой + опубликованные
  const conditions: any[] = [
    eq(articleBooks.bookId, params.bookId),
    eq(articles.status, "published"),
  ];
  if (params.role) conditions.push(eq(articleBooks.role, params.role));

  const where = and(...conditions);

  // 2) sort
  let sortColumn: any;
  switch (sortBy) {
    case "views":
      sortColumn = articles.views;
      break;
    case "createdAt":
      sortColumn = articles.createdAt;
      break;
    case "sortOrder":
      sortColumn = articleBooks.sortOrder;
      break;
    case "publishedAt":
    default:
      sortColumn = articles.publishedAt;
      break;
  }

  const orderByExpr = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

  // 3) base rows: article_books -> articles -> users
  const rows = await db
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

      // author
      authorId: users.id,
      username: users.username,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,

      // link metadata
      linkRole: articleBooks.role,
      linkSortOrder: articleBooks.sortOrder,
    })
    .from(articleBooks)
    .innerJoin(articles, eq(articles.id, articleBooks.articleId))
    .leftJoin(users, eq(users.id, articles.authorUserId))
    .where(where)
    .orderBy(orderByExpr)
    .limit(limit)
    .offset(offset);

  const articleIds = rows.map(r => r.id);

  // 4) tags batch
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

  // 5) isReadLater batch
  let readLaterSet: Set<string> | null = null;
  if (params.userId && articleIds.length) {
    const rlRows = await db
      .select({ articleId: articleReadLater.articleId })
      .from(articleReadLater)
      .where(and(
        eq(articleReadLater.userId, params.userId),
        inArray(articleReadLater.articleId, articleIds),
      ));

    readLaterSet = new Set(rlRows.map(r => r.articleId));
  }

  // 6) dto
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

    author: r.authorId
      ? { id: r.authorId, username: r.username, fullName: r.fullName, avatarUrl: r.avatarUrl }
      : undefined,

    tags: tagsByArticleId.get(r.id) ?? [],
    isReadLater: readLaterSet ? readLaterSet.has(r.id) : undefined,

    bookLink: { role: r.linkRole, sortOrder: r.linkSortOrder },
  }));

  // 7) total
  const countRes = await db
    .select({ count: count() })
    .from(articleBooks)
    .innerJoin(articles, eq(articles.id, articleBooks.articleId))
    .where(where);

  const total = Number(countRes[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return { articles: articlesDto, total, page, limit, totalPages };
}

3) Что важно в UI вкладке книги

Ссылку строить по slug: /articles/${slug}

Если хочешь “порядок списка” как в статье-подборке, используйте:

role=in_list

sortBy=sortOrder&sortOrder=asc

Если ты хочешь, я следующим шагом могу:

подсказать точную структуру фронтового хука/компонента для вкладки книги “Статьи” (с пагинацией, фильтром role и сортировкой), чтобы Qoder сделал UI без сюрпризов.

Давай
Думал на протяжении пары секунд

Ок, давай — набросаю готовую реализацию UI-вкладки “Статьи” на странице книги (с пагинацией, фильтром по роли, сортировкой и “читать позже”), которую Qoder сможет просто вставить.

Небольшой момент: я не вижу ваш текущий BookDetailPage/BookTabs, потому что часть ранее загруженных файлов у меня уже истекла. Если хочешь — можешь потом закинуть файл страницы книги, и я подгоню точные места вставки. Но компонент ниже самодостаточный.

1) Компонент BookArticlesTab.tsx

Создай файл, например:
client/src/components/books/BookArticlesTab.tsx

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Bookmark, BookmarkCheck, Eye, MessageCircle } from "lucide-react";

type ArticleTag = { id: string; axis: string; name: string; slug: string };

type ArticleAuthor = {
  id: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
};

type BookLinkMeta = { role: "primary" | "in_list" | "mentioned"; sortOrder: number };

type ArticleCard = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  section: string | null;
  format: string | null;
  lang: string;
  views: number;
  commentsCount: number;
  publishedAt: string | null;
  createdAt: string;
  author?: ArticleAuthor;
  tags: ArticleTag[];
  isReadLater?: boolean;
  bookLink?: BookLinkMeta;
};

type ApiResult = {
  articles: ArticleCard[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function BookArticlesTab({ bookId }: { bookId: string }) {
  const [role, setRole] = useState<"all" | "primary" | "in_list" | "mentioned">("all");
  const [sortBy, setSortBy] = useState<"publishedAt" | "views" | "sortOrder">("publishedAt");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const [page, setPage] = useState(1);
  const [limit] = useState(12);

  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);

  const authToken = useMemo(() => localStorage.getItem("authToken"), []);
  const headers = useMemo(() => {
    return authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
  }, [authToken]);

  // Если выбрали role=in_list — логично сортировать по sortOrder asc
  useEffect(() => {
    if (role === "in_list") {
      setSortBy("sortOrder");
      setSortOrder("asc");
    } else if (sortBy === "sortOrder") {
      // если ушли с in_list, вернем на publishedAt desc
      setSortBy("publishedAt");
      setSortOrder("desc");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // При смене фильтров — сбрасываем страницу
  useEffect(() => {
    setPage(1);
  }, [role, sortBy, sortOrder]);

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
      } catch (e) {
        console.error(e);
        setData({ articles: [], total: 0, page, limit, totalPages: 1 });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [bookId, page, limit, role, sortBy, sortOrder, headers]);

  const toggleReadLater = async (article: ArticleCard) => {
    // Оптимистично
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        articles: prev.articles.map(a =>
          a.id === article.id ? { ...a, isReadLater: !a.isReadLater } : a
        ),
      };
    });

    try {
      const endpoint = `/api/articles/${article.id}/read-later`;
      const method = article.isReadLater ? "DELETE" : "POST"; // было true → удалить
      const res = await fetch(endpoint, { method, headers: headers ?? {} });
      if (!res.ok) throw new Error(`ReadLater failed: ${res.status}`);
    } catch (e) {
      console.error(e);
      // откат
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          articles: prev.articles.map(a =>
            a.id === article.id ? { ...a, isReadLater: article.isReadLater } : a
          ),
        };
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={role} onValueChange={(v) => setRole(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Роль" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="primary">Основные</SelectItem>
              <SelectItem value="in_list">В подборках</SelectItem>
              <SelectItem value="mentioned">Упоминания</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Сортировка" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="publishedAt">По дате публикации</SelectItem>
              <SelectItem value="views">По просмотрам</SelectItem>
              <SelectItem value="sortOrder">По порядку в списке</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Порядок" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">По убыванию</SelectItem>
              <SelectItem value="asc">По возрастанию</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground">
          {data ? `Найдено: ${data.total}` : " "}
        </div>
      </div>

      {/* List */}
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка…
        </div>
      )}

      {!loading && data && data.articles.length === 0 && (
        <div className="text-sm text-muted-foreground">Пока нет статей по этой книге.</div>
      )}

      <div className="grid gap-3">
        {data?.articles.map((a) => {
          const authorName = a.author?.fullName || a.author?.username || "Reader";
          const chips = (a.tags || []).slice(0, 4);

          return (
            <Card key={a.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/articles/${a.slug}`}>
                      <a className="font-semibold leading-snug hover:underline line-clamp-2">
                        {a.title}
                      </a>
                    </Link>

                    {a.excerpt && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {a.excerpt}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleReadLater(a)}
                    title={a.isReadLater ? "Убрать из читать позже" : "Добавить в читать позже"}
                    disabled={!authToken}
                  >
                    {a.isReadLater ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Автор: {authorName}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {a.views ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {a.commentsCount ?? 0}
                  </span>

                  {a.bookLink?.role && (
                    <>
                      <span>•</span>
                      <Badge variant="secondary" className="text-xs">
                        {a.bookLink.role === "primary"
                          ? "Основная"
                          : a.bookLink.role === "in_list"
                            ? `В подборке #${a.bookLink.sortOrder ?? 0}`
                            : "Упоминание"}
                      </Badge>
                    </>
                  )}
                </div>

                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {chips.map((t) => (
                      <Badge key={t.slug} variant="outline" className="text-xs">
                        {t.name}
                      </Badge>
                    ))}
                    {(a.tags?.length ?? 0) > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{(a.tags.length - 4)}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={loading || page <= 1}
          >
            Назад
          </Button>

          <div className="text-sm text-muted-foreground">
            Страница {page} из {data.totalPages}
          </div>

          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            disabled={loading || page >= data.totalPages}
          >
            Вперёд
          </Button>
        </div>
      )}
    </div>
  );
}

2) Как встроить в страницу книги

В вашем BookDetailPage (или где вкладки), в табе “Статьи”:

<BookArticlesTab bookId={book.id} />

3) Пара требований к backend (чтобы UI работал “как надо”)

Проверь, что GET /api/books/:bookId/articles отдаёт элементы с полями:

slug (обязательно)

author (вложенный) или хотя бы authorId/username/fullName/avatarUrl → но лучше вложенный

tags: [] (даже пустой массив)

isReadLater (если есть auth)

bookLink: { role, sortOrder } (опционально, но красиво)

Твой метод getArticlesByBook() выше как раз так и отдаёт.

Если хочешь — сделаю идеально под твой текущий BookDetail

Скинь файл страницы книги/вкладок (например BookDetailPage.tsx или компонент Tabs) — я скажу ровно куда вставить, и как лучше назвать вкладку/иконку/счётчик “N статей”.

BookDetail.tsx
TypeScript
Думал на протяжении 34s

Посмотрел твой BookDetail.tsx — сейчас там табы только “Комментарии / Рецензии”. Давай встроим туда третью вкладку “Статьи” и подключим компонент BookArticlesTab (который я выше дал).

Ниже — точечный патч: что именно добавить/поменять.

1) Создай файл компонента вкладки

Создай файл:

client/src/components/books/BookArticlesTab.tsx

И вставь туда компонент из моего прошлого сообщения (тот большой BookArticlesTab с fetch /api/books/${bookId}/articles..., фильтром роли, сортировкой и read-later).
Важно: он использует Link из wouter с href — это совпадает с твоим проектом.

2) Внеси правки в BookDetail.tsx
A) Добавь импорт компонента

В начале файла добавь:

import { BookArticlesTab } from '@/components/books/BookArticlesTab';


(путь ровно такой, если положишь компонент как в пункте 1)

B) Сделай 3 вкладки вместо 2

Найди блок:

<TabsList className="grid w-full grid-cols-2">
  <TabsTrigger value="comments">{t('books:commentCount')} ({bookComments.length})</TabsTrigger>
  <TabsTrigger value="reviews">{t('books:reviewCount')} ({bookReviews.length})</TabsTrigger>
</TabsList>


Заменить на:

<TabsList className="grid w-full grid-cols-3">
  <TabsTrigger value="comments">{t('books:commentCount')} ({bookComments.length})</TabsTrigger>
  <TabsTrigger value="reviews">{t('books:reviewCount')} ({bookReviews.length})</TabsTrigger>
  <TabsTrigger value="articles">Статьи</TabsTrigger>
</TabsList>


Если хочешь i18n — можно потом заменить “Статьи” на t('books:articles'), когда добавишь ключ.

C) Добавь <TabsContent value="articles">

Сразу после блока reviews-tab (после </TabsContent> для reviews) вставь:

{/* Articles Tab */}
<TabsContent value="articles" className="mt-0">
  <CardContent className="pt-4">
    <BookArticlesTab bookId={bookId} />
  </CardContent>
</TabsContent>


Готово: вкладка появится и начнёт дергать API /api/books/:bookId/articles.

3) Маленький нюанс (чтобы не было “почему кнопка не работает”)

В BookArticlesTab я делал read-later кнопки disabled, если нет authToken. Это правильно.
Убедись, что у тебя везде используется один ключ токена: authToken (ты уже это правишь в других местах).

4) Что должно быть на бэке

Чтобы вкладка работала, должен быть:

GET /api/books/:bookId/articles (мы уже писали роут)

storage.getArticlesByBook() (мы уже писали метод)

и чтобы ответ содержал slug, author, tags, isReadLater, bookLink

Если хочешь — могу прямо сейчас подсказать, как красиво показать счётчик статей на вкладке (“Статьи (N)”) без лишних запросов: либо бэк возвращает total и мы ставим его в label, либо добавляем лёгкий endpoint /api/books/:bookId/articles/count.

Покажи как красиво показать счётчик статей
Думал на протяжении секунды

Можно сделать красиво без лишнего шума и так, чтобы счётчик:

показывался прямо на вкладке: “Статьи (N)”

обновлялся после загрузки списка

не мигал “0” до загрузки (лучше “…” или скрывать)

Я дам лучший вариант: использовать total из ответа /api/books/:bookId/articles, который у тебя уже возвращается ({ total, totalPages, ... }). Дополнительный endpoint /count не нужен.

Вариант “лучший”: счётчик из total и обновление из вкладки
1) В BookArticlesTab.tsx добавь проп onTotalChange

Измени сигнатуру:

export function BookArticlesTab({
  bookId,
  onTotalChange,
}: {
  bookId: string;
  onTotalChange?: (total: number) => void;
}) {

2) После setData(json) дерни коллбек

В месте, где ты загружаешь данные:

setData(json);
onTotalChange?.(json.total ?? 0);


И ещё: если запрос упал — можно отправить 0, но я бы не трогал (чтобы не затирать прошлый счётчик). Тогда просто не вызывай коллбек в catch.

3) В BookDetail.tsx заведи состояние счётчика и покажи в TabsTrigger
A) Добавь state рядом с другими useState:
const [articlesTotal, setArticlesTotal] = useState<number | null>(null);


null = “ещё не загрузили”.

B) TabsTrigger “Статьи” сделай с бейджем

Заменяешь кнопку вкладки “Статьи” на:

<TabsTrigger value="articles" className="gap-2">
  Статьи
  <span className="ml-1 inline-flex min-w-[24px] items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
    {articlesTotal === null ? "…" : articlesTotal}
  </span>
</TabsTrigger>


Получится аккуратный “пилюльный” счётчик.

Если хочешь, чтобы счётчик появлялся только после загрузки:
вместо "…" можно "" и условный рендер.

C) В TabsContent передай коллбек:

Там где ты вставил вкладку статей:

<BookArticlesTab bookId={bookId} onTotalChange={setArticlesTotal} />

4) Доп.полировка: сброс счётчика при смене книги

Если BookDetail.tsx может переключаться между книгами без размонтирования, добавь:

useEffect(() => {
  setArticlesTotal(null);
}, [bookId]);

Что получится

Открыл книгу → вкладка “Статьи (…)”

Как только таб “Статьи” первый раз загрузит список → станет “Статьи (12)”

Сортировки/роль/страница меняются → total обычно не меняется, но если меняется, обновится автоматически

Альтернатива (если хочешь счётчик до открытия вкладки)

Если ты хочешь, чтобы счётчик показывался сразу (даже если вкладку “Статьи” ещё не открывали), тогда нужен:

либо лёгкий endpoint /api/books/:bookId/articles/count

либо префетч первого запроса в фоне при открытии BookDetail (но это уже дополнительные запросы)

Я бы начал с “лучшего” варианта выше — он самый простой и без лишней нагрузки.