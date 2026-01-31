Стало заметно лучше (ты был прав, Qoder часть вещей реально починил), но “что-то не так” всё ещё есть — и это уже не про вкус/UX, а про несовпадение контракта между фронтом ↔ API ↔ storage ↔ schema/миграциями.

Ниже: что хорошо, что осталось сломанным, и готовый текст, который можно просто переслать Qoder.

✅ Что стало лучше

Editor теперь сохраняет по articleId, а не по slug
ArticleEditorPage.tsx: PUT /api/articles/${articleId} — это правильный шаг.

ArticlesPage теперь реально ходит в API с query params
Поиск/фильтр не только локально — уже лучше.

Read later endpoints на фронте совпадают с сервером:
GET /api/articles/read-later, POST/DELETE /api/articles/:id/read-later — ок.

❌ Что всё ещё не так (критично)
1) GET /api/articles/:identifier возвращает “голую” статью, а фронт ждёт { article }

Сервер (routes): res.json(article);

Фронт (ArticleDetailPage): проверяет if (data.article) { ... }

➡️ В итоге ArticleDetailPage не показывает статью вообще, потому что data.article отсутствует.

Что сделать: либо:

вариант A (лучше): вернуть на сервере { article } (как в create)

вариант B: переписать фронт на “голый” ответ
Но нужно выбрать один стиль и держать везде.

2) Update route возвращает не { article }, а “голый объект” → Editor ломает redirect

Create: res.status(201).json({ article });

Update: res.json(updatedArticle);

Editor делает: window.location.href = /articles/${result.article.slug}

➡️ После “Сохранить” редирект может сломаться, потому что result.article нет.

Что сделать: в update route вернуть так же: res.json({ article: updatedArticle }).

3) В server/storage.ts всё ещё есть обращения к articles.viewCount

В listArticles():

sortBy: 'publishedAt' | 'createdAt' | 'viewCount'

sortColumn = articles.viewCount

Но в shared/schema.ts у articles поле называется views, а viewCount не существует.

➡️ Это либо не компилируется, либо будет падать.

Что сделать: заменить viewCount → views во всех местах (и в типах параметров тоже).

4) shared/schema.ts содержит дубли определений (это прям красная лампа)

Внутри файла видно, что блоки articleTags / articles / articleBooks встречаются повторно (скорее всего результат “склейки” при фиксе).

➡️ Это может:

ломать сборку (дубли export const),

давать странные типы,

“маскировать” нужные определения.

Что сделать: вычистить shared/schema.ts так, чтобы каждую таблицу/тип экспортировали ровно один раз.

5) Теги и книги формально “есть”, но фактически не сохраняются / не возвращаются

В routes create/update принимают tags, но:

storage.createArticle() просто делает insert в articles и не записывает в article_tags / article_tag_links.

storage.getArticleById/Slug возвращает только articles.* без tags и без attachedBooks.

➡️ UI отправляет tags, но они пропадают.
И на detail нельзя показать связанные книги/теги, потому что backend их не отдаёт.

Что сделать: либо:

на уровне storage: после create/update вызвать attachTagsToArticle() и attachBooksToArticle(),

и добавить методы getArticleTags() / getArticleAttachedBooks() в getArticle().

6) Миграция 0036_articles_v1_clean.sql слишком “грубая”

Она:

делает CREATE TABLE IF NOT EXISTS ... (если таблица уже была — структура может не обновиться),

и DROP TABLE discussion_ CASCADE* (может снести то, что кто-то уже успел использовать).

➡️ Для dev ок, но аккуратнее: либо делайте отдельный “cleanup for dev only”, либо миграцию через ALTER TABLE ... ADD COLUMN IF NOT EXISTS.

📌 Что передать Qoder (одним сообщением)

Скопируй и отправь ему:

Qoder, привет. Стало лучше, но контракт ещё разъезжается. Доведи до консистентного v1:

1) Привести API к единому формату ответа

Сейчас create возвращает { article }, а get/update возвращают “голую” статью. Из-за этого фронт ломается.

GET /api/articles/:identifier → вернуть res.json({ article })

PUT /api/articles/:id → вернуть res.json({ article: updatedArticle })
(или альтернативно — изменить фронт на “голые” ответы, но выбрать один стиль везде)

2) Исправить ArticleDetailPage под фактический ответ

Сейчас он ждёт data.article. После пункта (1) он заработает без правок.
Если решим оставить “голый” ответ — тогда поменять на setArticle(data).

3) Починить storage сортировку: viewCount → views

В server/storage.ts listArticles() использует articles.viewCount, а в schema поле views.

заменить viewCount на views везде

поправить тип sortBy на 'publishedAt' | 'createdAt' | 'views'

4) Убрать дубли в shared/schema.ts

Сейчас в файле повторно экспортируются articleTags/articles/articleBooks и т.п.
Нужно оставить по одному определению каждой таблицы/типа.

5) Реально сохранять и возвращать tags/books

Сейчас tags из запроса не попадают в article_tags/article_tag_links, а getArticle не возвращает связи.
Сделать так:

в createArticle() после insert вызвать attachTagsToArticle(article.id, tags)

аналогично в updateArticle()

в getArticleById/Slug возвращать расширенную структуру:
{ ...article, tags: [...], attachedBooks: [...] }

(books можно пока не делать в UI, но если принимаем tags — они должны реально работать)

6) Миграции

0036 не гарантирует апдейт существующих таблиц (из-за IF NOT EXISTS). Лучше отдельными миграциями:

ALTER TABLE article_tags ADD COLUMN IF NOT EXISTS axis ...

ALTER TABLE article_books ADD COLUMN IF NOT EXISTS role/sort_order ...
и т.д., без разрушительных DROP, либо пометить DROP как dev-only.

Если коротко “что я скажу”

Сейчас стало ближе, но:

detail не грузится из-за формата ответа,

update ломает редирект,

storage ссылается на несуществующее viewCount,

schema.ts дублирован,

tags/books не сохраняются и не возвращаются.

Если хочешь, я могу сделать ещё полезнее: составить для Qoder мини-чеклист по файлам “вот эти 10 строк поменять тут/тут/тут” (прямо конкретные правки в server/routes.ts, server/storage.ts, ArticleDetailPage.tsx, shared/schema.ts).

Давай
Думал на протяжении 3m 19s

Да, стало ближе к рабочему, но по текущему diff_files.zip у вас всё ещё есть 3 корневых “разъезда”, из-за которых UI будет вести себя “не так”:

Формат ответов API разный (POST возвращает { article }, а GET/PUT/publish — “голый” объект) → ломает Editor/Detail.

viewCount vs views (и местами в storage до сих пор articles.viewCount, которого нет в schema) → ломает сортировки/отображение.

Лента и детали ждут author/tags, но backend их не отдаёт (listArticles сейчас просто select * from articles) → поля author/tags в ArticlesPage.tsx будут undefined.

Ниже — микро-чеклист “что поменять где”. Это можно 1-в-1 переслать Qoder.

✅ Сообщение для Qoder (чеклист правок по файлам)
1) server/routes.ts — унифицировать ответы (везде { article })

Сейчас:

POST /api/articles → { article } ✅

GET /api/articles/:identifier → res.json(article) ❌

PUT /api/articles/:id → res.json(updatedArticle) ❌

POST /api/articles/:id/publish → res.json(updatedArticle) ❌

Надо:

в GET заменить res.json(article); на:

res.json({ article });


в PUT заменить res.json(updatedArticle); на:

res.json({ article: updatedArticle });


в publish заменить res.json(updatedArticle); на:

res.json({ article: updatedArticle });


Это сразу починит:

редирект после save в редакторе,

загрузку статьи в detail.

2) client/src/pages/ArticleEditorPage.tsx — убрать legacy publicationType и не падать на update

Сейчас Editor отправляет publicationType, но backend его игнорирует — это мусор и источник путаницы.

Надо:

из body JSON убрать строку:

publicationType: formData.publicationType || null,


Editor уже ждёт result.article.slug — после пункта (1) update тоже начнёт возвращать { article }, и редирект станет стабильным.

3) client/src/pages/ArticleDetailPage.tsx — заменить save/unsave на read-later + брать isReadLater из ответа

Сейчас Detail делает:

загрузка ждёт data.article ✅ (после фикса API заработает)

но toggleSave использует /save и /unsave ❌ (на сервере это /read-later)

Надо:

заменить toggle на:

const endpoint = `/api/articles/${article.id}/read-later`;
const method = isSaved ? 'DELETE' : 'POST';


и при загрузке статьи (после setArticle(...)) установить isSaved из ответа сервера:

setIsSaved(!!data.article.isReadLater);


Для этого storage должен добавлять isReadLater в getArticle(...) (пункт 6).

4) server/storage.ts — срочно исправить viewCount → views в listArticles

В listArticles() сейчас:

sortBy: 'publishedAt' | 'createdAt' | 'viewCount'
...
case 'viewCount': sortColumn = articles.viewCount;


Но в shared/schema.ts у articles поле views, а viewCount не существует.

Надо:

заменить тип:

sortBy: 'publishedAt' | 'createdAt' | 'views'


заменить switch:

case 'views':
  sortColumn = articles.views;
  break;


И в routes.ts (в list endpoint) пусть sortBy принимает views.

5) server/storage.ts — read-later сейчас выбирает несуществующие колонки (contentHtml/categoryId/viewCount)

В getUserReadLaterArticles() сейчас выбирается:

articles.contentHtml ❌

articles.categoryId ❌

articles.replyToArticleId ❌

articles.viewCount ❌

Надо: вернуть только реальные поля из schema:

id, authorUserId, title, slug, excerpt, contentJson, section, format, views, commentsCount, createdAt, publishedAt

И лучше сделать запрос через join с articleReadLater, но select из articles.

6) server/storage.ts — добавить в getArticle() флаг isReadLater (если есть userId)

Сейчас getArticleById/Slug userId игнорируют.

Надо:

если currentUserId задан, проверить articleReadLater на существование записи (userId, articleId) и добавить в возвращаемый объект:

(isReadLater: boolean)


Это нужно, чтобы Detail правильно подсвечивал “в избранном/читать позже”.

7) client/src/pages/ArticlesPage.tsx — привести интерфейс к тому, что реально отдаёт backend (или сделать backend богаче)

Сейчас интерфейс на фронте ждёт:

author { username, fullName }

tags: Array<{name, slug}>

viewCount

Но storage.listArticles() возвращает просто строки из articles без author/tags и без viewCount.

Есть два пути:

Вариант A (быстрый MVP):
в ArticlesPage.tsx убрать author/tags из интерфейса и UI, и заменить viewCount на views.

Вариант B (правильнее для продукта):
доработать storage.listArticles() чтобы возвращал карточки:

author (join users по authorUserId)

tags (batch-запрос по articleTagLinks/articleTags для списка articleIds)

views (из articles.views)

Я бы рекомендовал B, но A можно сделать за 10 минут, чтобы “перестало казаться кривым”.

Мини-итог: что у вас “не так” прямо сейчас

Editor/Detail “странно” работают из-за разного формата ответов API.

Views/сортировка “странно” из-за viewCount vs views.

Лента кажется пустой/кривой из-за ожидания author/tags, которых backend не отдаёт.

Save/unsave на detail не работает, потому что endpoint другой (read-later).