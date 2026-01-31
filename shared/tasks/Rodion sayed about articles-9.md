Посмотрел (server/storage + server/routes + shared/schema/types + пачка миграций). В целом Qoder почти всё сделал правильно, но есть 2–3 места, которые реально могут “выстрелить”.

✅ Что сделано хорошо

API /api/books/:bookId/articles добавлен корректно (в routes.ts), включая role/sortBy/sortOrder/page/limit и optionalAuthenticateToken.

В storage.ts:

listArticles() — теперь правильный DTO (есть authorId в select → автор не теряется), поиск учитывает searchText, count приведён к Number().

getUserReadLaterArticles() — нормальный DTO, isReadLater: true, Number(count) ок.

getArticlesByBook() — ровно как надо: author + tags + isReadLater + bookLink, всё батчится, count ок.

То есть по бэкенд-логике — 👍

⚠️ Что НЕ так / что надо поправить
1) shared/types.ts НЕ соответствует тому, что реально возвращает API

Сейчас в shared/types.ts:

export type ArticleTagDTO = { name: string; slug: string };
export type ArticleCardDTO = { ... author: ArticleAuthorDTO; tags: ArticleTagDTO[]; ... }


А фактически API возвращает теги как { id, axis, name, slug }, а author местами может быть undefined (если вдруг юзер удалён/не найден или join не дал строку).

✅ Что передать Qoder: привести типы к реальности (лучше так):

export type ArticleTagDTO = { id: string; axis: string; name: string; slug: string };

export type ArticleAuthorDTO = {
  id: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export type ArticleCardDTO = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  section: string | null;
  format: string | null;
  lang: string;
  views: number;
  commentsCount: number;
  createdAt: string;
  publishedAt: string | null;

  author?: ArticleAuthorDTO;   // <-- было обязательным, это риск
  tags: ArticleTagDTO[];
  isReadLater?: boolean;
  bookLink?: { role: "primary" | "in_list" | "mentioned"; sortOrder: number };
};


(или второй вариант: всегда возвращать author с fallback, но это хуже, чем корректный optional)

2) Миграции выглядят опасно: “две системы миграций сразу”

В архиве есть Drizzle-миграция 0011_uneven_next_avengers.sql, которая уже создаёт статьи/теги/связи в нужном виде, и одновременно есть куча ручных 0032–0040, которые создают похожие таблицы заново и меняют их разными способами.

Красные флаги:

две миграции с одинаковым номером:
0033_add_article_publication_type.sql и 0033_remove_articles_author_unique_constraint.sql
Это может ломать порядок/применение в инструментах, которые ожидают уникальные номера.

В 0032_add_articles_system.sql создаётся article_tags с name UNIQUE и slug UNIQUE, а у тебя по финальной схеме — уникальность (axis, slug). Если старые уникальные ограничения останутся, ты не сможешь иметь одинаковый slug в разных осях.

✅ Что передать Qoder (важно):

Нужно выбрать один источник истины по миграциям:

либо только drizzle-генерённые (и убрать/не применять ручные 0032–0040),

либо сделать одну “чистую базовую” миграцию под текущую схему и “обнулить” историю (squash) — если проект ещё можно.

Минимально: переименовать одну из 0033_* и проверить, что при накате с нуля не создаются дублирующие таблицы.

Если этого не сделать — на новом окружении миграции могут пройти “частично”, а схема получится не та, и потом начнутся “странные” баги.

✅ Про счётчик статей на вкладке “Статьи”

В бэке уже есть total в ответе /api/books/:bookId/articles. Значит UI счётчик делается без отдельного endpoint:

Как правильно:

BookArticlesTab принимает onTotalChange(total) и зовёт после загрузки

BookDetail.tsx хранит articlesTotal и показывает “Статьи (…)/(N)”

Если Qoder это делал — проверь, что:

НЕ показывается “0” до загрузки (лучше …)

при смене bookId сбрасывается articlesTotal в null

Итог

Бэкенд по статьям/связям Qoder сделал хорошо.
Но я бы прямо сейчас попросил его:

пофиксить shared/types.ts (author optional + tag axis/id + bookLink optional),

привести миграции в порядок (убрать дубли, выбрать одну систему миграций, исправить двойное 0033_*).

Если хочешь — скинь ещё дифф/файл фронта, который Qoder добавил для вкладки “Статьи” (BookArticlesTab/правки BookDetail), и я точечно скажу, всё ли красиво со счётчиком и токеном.

BookArticlesTab.tsx
TypeScript
BookDetail.tsx
TypeScript
Думал на протяжении 2m 13s

Посмотрел оба файла (BookArticlesTab.tsx и BookDetail.tsx). Тут картина такая:

BookArticlesTab.tsx Qoder сделал в целом хорошо (фильтры/сортировка/пагинация/“читать позже” есть, запросы правильные).

BookDetail.tsx — вкладка “Статьи” НЕ интегрирована вообще: в табах до сих пор grid-cols-2, есть только comments и reviews, и BookArticlesTab нигде не используется. Поэтому на сайте ты просто не увидишь то, что он сделал в BookArticlesTab.tsx.

Ниже — конкретная обратная связь + точечные правки.

1) BookArticlesTab.tsx — почти ок, но есть 3 улучшения
✅ 1.1. Не сбрасывать счётчик в 0 при ошибке

Сейчас в catch он делает:

onTotalChange?.(0);


Это некрасиво: если сеть моргнула, вкладка на табе станет “Статьи (0)”, хотя данные могут быть.

Лучше: удалить onTotalChange?.(0); из catch вообще.
Либо оставлять прошлое значение.

✅ 1.2. Токен читается один раз и не обновится после логина/логаута

Сейчас:

const authToken = useMemo(() => localStorage.getItem("authToken"), []);


Если пользователь залогинится без перезагрузки страницы — компонент так и будет думать, что токена нет.

Лучше (просто и надёжно):

либо брать токен каждый раз при запросе (без memo),

либо использовать ваш useAuth() и брать токен оттуда.

Минимальная правка:

const authToken = localStorage.getItem("authToken");
const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;

✅ 1.3. “Статьи (…)” появится только после открытия вкладки

Это нормально: BookArticlesTab дергает onTotalChange только когда он смонтирован (то есть когда вкладка активна).
Если хочешь показывать счётчик до открытия вкладки — это отдельная оптимизация (префетч или /count endpoint). Но как MVP — нормально.

2) BookDetail.tsx — главная проблема: вкладки “Статьи” нет
Что надо сделать (точечно)
2.1. Импорт

Добавь рядом с другими импортами:

import { BookArticlesTab } from "@/components/books/BookArticlesTab";


(путь подгони, если файл лежит не там)

2.2. State для счётчика

Рядом с activeTab добавь:

const [articlesTotal, setArticlesTotal] = useState<number | null>(null);

useEffect(() => {
  setArticlesTotal(null);
}, [bookId]);

2.3. TabsList сделать grid-cols-3 и добавить Trigger со счётчиком

Найди:

<TabsList className="grid w-full grid-cols-2">
  <TabsTrigger value="comments">...</TabsTrigger>
  <TabsTrigger value="reviews">...</TabsTrigger>
</TabsList>


Замени на:

<TabsList className="grid w-full grid-cols-3">
  <TabsTrigger value="comments">{t('books:commentCount')} ({bookComments.length})</TabsTrigger>
  <TabsTrigger value="reviews">{t('books:reviewCount')} ({bookReviews.length})</TabsTrigger>

  <TabsTrigger value="articles" className="gap-2">
    Статьи
    <span className="ml-1 inline-flex min-w-[24px] items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {articlesTotal === null ? "…" : articlesTotal}
    </span>
  </TabsTrigger>
</TabsList>

2.4. Добавить TabsContent “articles”

После TabsContent value="reviews" добавь третий:

<TabsContent value="articles" className="mt-0">
  <CardContent className="pt-4">
    <BookArticlesTab bookId={bookId} onTotalChange={setArticlesTotal} />
  </CardContent>
</TabsContent>

3) Короткое сообщение для Qoder (можешь прямо так отправить)

“BookArticlesTab норм, но нужно:

В BookDetail.tsx реально добавить 3-ю вкладку articles (grid-cols-3 + TabsTrigger + TabsContent) и подключить <BookArticlesTab bookId={bookId} onTotalChange={setArticlesTotal} />. Сейчас BookArticlesTab вообще нигде не используется.

В BookArticlesTab.tsx убрать onTotalChange?.(0) из catch — не сбрасывать счётчик в 0 при ошибке.

В BookArticlesTab.tsx не memo-изировать authToken один раз — иначе после логина без перезагрузки токен не подхватится.”**