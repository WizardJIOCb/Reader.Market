Task for Qoder: Articles system v1 (simple taxonomy + book links + search)
Goal

Implement a simple, scalable Articles feature for Reader.Market: publish posts about books, attach a list of related books, and allow users to find articles by book and by title/content.
Avoid building a complex forum engine now. Keep taxonomy minimal and navigation simple.

Non-goals (for v1)

No separate forum/discussion engine with categories/threads/posts.

No huge article_type enum with dozens of values.

No advanced full-text search infra required initially (ILIKE ok for v1, but structure should allow FTS later).

Product requirements
1) Taxonomy (simple and stable)

Each article has:

section (main category): small fixed list

format (publication format): small fixed list

tags: flexible, used as filters (tags replace deep subcategories)

section enum (max 7):

news — announcements/releases/industry news

reviews — reviews/opinions

collections — lists/top/picks

guides — how-to/reading guides

world — awards/events/adaptations/publishing

community — challenges/club posts/user posts

product — Reader.Market updates/help

format enum (max 8):

announcement

release

translation

review

list

analysis

event

note

tags

free tags, with an optional axis: genre | theme | mood | country | award | language | other

tags are used for filtering on /articles

2) Book attachments (must-have)

Article can attach 0..N books.
Each attachment has:

bookId

role: primary | in_list | mentioned

sortOrder (for lists/reading order)

This enables:

/books/:id -> tab “Articles” listing related articles

/articles filter by book

list articles with ordered books (for collections)

3) Discoverability (search + filters)

On /articles implement:

text search (title + excerpt + content)

filters: section, format, tags (multi), lang

optional filter: “only with book links”

sorting: newest / popular (views) (views optional, but structure exists)

On book page:

“Articles” tab shows articles linked to this book (any role), with quick filter:

all / only primary / only “in lists” (optional)

4) Minimal “discussion” for v1

Do not build forum tables.
If comments already exist in project (comments, reactions), reuse them for articles.
If not, allow v1 to ship without comments.

Data model (PostgreSQL + Drizzle)

Create 4 tables:

articles

Fields:

id uuid pk

authorId fk users

section enum

format enum

status enum: draft | published | archived

lang string (ru default)

title, slug (unique per lang), excerpt?, coverImageUrl?

contentMd? (or contentJson? if editor is JSON-based)

searchText? (optional denorm for search; can be filled on save)

views int default 0 (optional v1)

publishedAt?, createdAt, updatedAt

Indexes:

unique(slug, lang)

index(status), index(section), index(format), index(publishedAt)

article_books

Fields:

id uuid pk

articleId fk articles

bookId fk books

role enum: primary | in_list | mentioned

sortOrder int default 0

unique(articleId, bookId)

index(bookId), index(articleId)

article_tags

Fields:

id uuid pk

axis enum

name, slug

unique(axis, slug)

index(axis)

article_tag_links

Fields:

id uuid pk

articleId fk articles

tagId fk article_tags

unique(articleId, tagId)

index(articleId), index(tagId)

API requirements (Express)
Public

GET /api/articles
Query params:

query (string)

section (string)

format (string)

tagIds (comma list) OR tags (slugs) (pick one and standardize)

lang

bookId

onlyWithBooks boolean

sort = new | popular (default new)

page, pageSize

Returns:

list of article cards + pagination info

include: linked book ids count + maybe first 3 linked books for preview (optional)

GET /api/articles/:slug (or :id)
Return:

article full content

linked books (ordered)

tags

GET /api/books/:bookId/articles
Return:

articles linked to a book (with role and basic metadata)

Author/admin

POST /api/articles
Create draft.

PATCH /api/articles/:id
Update fields + replace linked books + replace tags (transaction).

POST /api/articles/:id/publish
Set status=published, publishedAt=now (server time).

POST /api/articles/:id/archive
status=archived.

Access control:

Only author or admin can edit/publish/archive.

UI requirements (React + TS + Vite + Tailwind/shadcn)
/articles

list with cards

search input

filters: section, format, tags, lang

optional: onlyWithBooks checkbox

pagination

Card shows:

title, excerpt, section, format, date

small chips: tags (optional)

“related books: N” (optional)

cover (optional)

/articles/:slug

full article view

related books block:

ordered list (if sortOrder)

role label only if needed (primary/in_list/mentioned)

each book clickable to its page

/articles/new and /articles/:id/edit

editor form:

title, slug, lang

section + format dropdowns

tags picker (search existing + create new)

related books picker (search books + set role + reorder via drag or up/down)

content editor (md or json)

actions: Save draft / Publish / Archive

Book page integration

add tab “Articles”

shows list from /api/books/:bookId/articles

Implementation notes / constraints

Keep enums small and stable.

Do not create a deep category tree. Use tags for flexibility.

Search v1: ILIKE on title and excerpt and contentMd (or searchText).
Structure should allow later switch to Postgres FTS.

Delivery / acceptance criteria

Author can create a draft, attach books, attach tags, publish.

/articles supports search and filtering; results are correct.

Book page shows linked articles.

Slug + lang uniqueness works; publishing sets publishedAt.

No forum engine tables introduced.

Suggested commit plan

Add DB schema + migrations (4 tables + enums + indexes)

Implement API endpoints (list/get/create/update/publish/archive + byBook)

Implement UI pages (/articles, detail, editor) + book page integration

Add basic seed for a few default tags (optional)