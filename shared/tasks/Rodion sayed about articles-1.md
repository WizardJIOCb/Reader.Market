Я посмотрел то, что Qoder наделал в diff_files.zip, и да: ощущение “что-то не то” абсолютно обосновано. Там не просто “не так”, там несостыковки между миграциями / схемой / storage / роутами / фронтом, из-за которых система либо не взлетит, либо будет ломаться.

Что конкретно “не то” (по факту из диффа)
1) Слишком разросся scope (появилось то, чего не просили)

Qoder добавил:

discussion_* “форумную” систему (и даже две разные версии таблиц обсуждений в разных миграциях),

“replies” к статьям как отдельный механизм,

article_categories (иерархия),

article_views, read-later и т.п.

Это не обязательно плохо, но сейчас это перекрыло главную цель: статьи + привязка к книгам + поиск по книгам/названию.

2) Главная проблема: схема БД ≠ storage.ts ≠ server/routes.ts

Примеры несостыковок (самое критичное):

В shared/schema.ts у articles есть views, а в storage.ts и routes.ts используются viewCount / articles.viewCount.

В storage.ts и routes.ts используется categoryId, publicationType, replyToArticleId, contentHtml, но в текущем articles из shared/schema.ts этих полей нет (или они “выпали” после переименований).

Есть дублирующиеся методы в storage.ts (видно несколько createArticle/getArticles и т.п.), что повышает шанс конфликтов/ошибок и реально уже привело к ним.

Это всё надо выровнять, иначе код не компилируется/не работает.

3) Миграции конфликтуют между собой

0034_add_discussion_forum_system.sql создаёт discussion_replies, discussion_views, триггеры и т.п.

0035_update_articles_schema.sql снова создаёт discussion_categories, discussions, discussion_posts и сиды.

В 0035 есть апдейты вроде UPDATE articles SET category_slug = ... — но category_slug может вообще отсутствовать.

Это очень опасно: миграции могут падать или оставить БД в странном состоянии.

4) Фронт не реализует главную фишку: привязку книг к статье

В ArticleEditorPage.tsx:

нет UI выбора книг,

“tags” — просто строки, без нормальной работы с article_tags/article_tag_links,

есть поле publicationType как “legacy”, но оно конфликтует с тем, что вы хотели (section/format).

В ArticlesPage.tsx:

фильтры сделаны частично и странно (две одинаковые кнопки “allCategories / allSections”),

поиск фильтрует только локально (клиентом), а не через API,

кнопка “Создать статью” показывается даже без авторизации (это баг по UX/безопасности).

Что передать Qoder сейчас (готовый единый фикс-таск)

Ниже текст, который можно просто скопировать и отправить Qoder.

✅ ТАСK ДЛЯ QODER: привести “Статьи” к минимальному рабочему v1 и выровнять всё
Цель v1

Сделать простую систему статей для Reader.Market:

статьи с section + format + tags

возможность прикреплять к статье список книг (0..N)

поиск статей по названию/тексту и по книге

без “форума/обсуждений” как отдельного движка на этом этапе.

СРОЧНО: исправить несостыковки

Сейчас миграции/схема/storage/routes/frontend не совпадают. Нужно привести к одному контракту.

1) Урезать scope и удалить лишнее (или выключить)

В v1 НЕ НУЖНО:

discussion/forum система (таблицы discussion_*, discussion_replies, триггеры),

“article replies” как отдельная сущность,

иерархические article_categories.

Если хочется оставить “на потом” — ок, но:

убрать из миграций v1,

убрать из routes,

убрать из storage,
чтобы это не ломало статьи.

2) ЕДИНАЯ схема БД для v1 (4 таблицы)

Оставить/сделать ровно это:

articles

id, authorUserId

section enum: news|reviews|collections|guides|world|community|product

format enum: announcement|release|translation|review|list|analysis|event|note

status enum: draft|published|archived

lang (ru default)

title, slug (unique по (slug, lang)), excerpt?, coverImageUrl?

contentJson (или contentMd, но выбрать один основной)

searchText (опционально)

views int default 0

commentsCount int default 0 (можно оставить на будущее)

publishedAt, createdAt, updatedAt

❗ Удалить из кода/БД любые categoryId, publicationType, replyToArticleId, contentHtml, viewCount — если они не используются.

article_books

articleId, bookId

role: primary|in_list|mentioned

sortOrder

unique(articleId, bookId), индекс по bookId

article_tags

axis: genre|theme|mood|country|award|language|other

name, slug, unique(axis, slug)

article_tag_links

articleId, tagId, unique(articleId, tagId)

(ReadLater и ArticleViews можно оставить только если они уже стабильно работают, но они НЕ обязательны для v1.)

3) Миграции: сделать чисто (важно)

Сейчас миграции конфликтуют.

Вариант А (лучше для dev): сбросить dev БД и сделать одну чистую миграцию “articles_v1_clean”.
Вариант B: сделать новую миграцию, которая:

удалит конфликтные таблицы discussion/forum,

удалит лишние типы/колонки,

приведёт articles к единому виду.

4) Backend: выровнять routes + storage под новую схему
API

Публичные

GET /api/articles?query&section&format&tagIds&lang&bookId&page&pageSize

GET /api/articles/:slug (возвращает статью + теги + связанные книги)

GET /api/books/:bookId/articles

Авторизованные

POST /api/articles (создать draft)

PATCH /api/articles/:id (обновить)

POST /api/articles/:id/publish

POST /api/articles/:id/archive (или PATCH status)

Важно

create/update должны принимать и сохранять: section, format, lang, tags, books[]

tags — либо массив строк (имён), и backend сам создаёт/находит article_tags, либо массив объектов — но выбрать один формат и держать.

Storage

Удалить дубли методов (оставить один createArticle, один listArticles, и т.д.)

Убрать обращения к несуществующим полям (viewCount/categoryId/publicationType/...)

Добавить нормальные методы:

setArticleBooks(articleId, books[]) (replace-all)

setArticleTags(articleId, tags[]) (replace-all)

getArticleWithRelations(slug|id) (article + tags + books)

5) Frontend: доделать главное
ArticleEditorPage

Добавить блок “Связанные книги”:

поиск книги (input + запрос к API поиска книг),

добавление в список,

роль (primary / in_list / mentioned),

сортировка (up/down или drag).

Теги:

можно оставить ввод строкой, но backend должен превращать это в article_tags + links.

ArticlesPage

убрать дубль “allCategories/allSections”

поиск/фильтры должны делать запрос к API, а не только клиентский .filter

кнопка “Создать статью” — показывать только авторизованным.

ArticleDetailPage

отображать связанные книги списком.

6) Acceptance criteria

Можно создать статью → выбрать section/format → прикрепить книги → теги → опубликовать.

/articles фильтруется через API.

На странице книги показывается список статей по книге.

Никаких discussion/forum таблиц и replies в v1.