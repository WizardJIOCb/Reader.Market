# SDD — Book Discovery Worker & Global Catalog (Reader.Market)

## 1. Цель документа
Описать архитектуру, данные и логику Worker-а, который:
1) Приоритетно ищет книги, которые **пользователи искали на сайте и не нашли**.
2) Параллельно наполняет базу **глобальным каталогом книг**, в актуальной очереди.
3) Формирует и поддерживает **единый канонический список книг** (title + author + year + identifiers).
4) Отмечает факт появления книги в сервисе и источник её обнаружения.

Документ предназначен для передачи команде разработки (Qoder).

---

## 2. Термины
- **Work** — произведение (абстрактная книга: название + автор).
- **Edition** — конкретное издание (год, ISBN, язык, издатель).
- **Global Catalog** — канонический список всех книг, которые «существуют».
- **Search Miss** — пользовательский поисковый запрос без результатов.
- **Discovery Worker** — фоновый процесс поиска и добавления книг.

---

## 3. Источники метаданных (легально)
Используются **только для метаданных**, не для пиратского контента.

### Основные
1. **Open Library (Internet Archive)** — базовый «скелет» каталога
   - Search API, Works API, Editions API
   - Храним: work_id, title, authors, year, ISBNs, subjects

2. **Wikidata** — построение глобального списка книг
   - SPARQL выгрузки
   - Храним: QID, title, author(QID), year, language

3. **Google Books API** — enrich (описания, категории, обложки)
   - Используется аккуратно, с учётом ToS
   - Храним только разрешённые поля

### Дополнительные
- Project Gutenberg (public domain)
- Internet Archive (rights-aware)
- HathiTrust (enrich по идентификаторам)
- Crossref (ISBN/DOI, научные книги)

---

## 4. Архитектура (high-level)

```
User Search → Search Miss Log
                    ↓
              Priority Queue
                    ↓
           Discovery Worker
        ↙          ↓           ↘
 OpenLibrary   Wikidata   Google Books
        ↓          ↓           ↓
          Metadata Normalizer
                    ↓
              Global Catalog DB
                    ↓
              Reader.Market DB
```

---

## 5. Модель данных (упрощённо)

### 5.1 global_works
Канонический список произведений
- id
- title
- normalized_title
- author_name
- author_id (optional)
- year
- language
- wikidata_qid
- openlibrary_work_id
- created_at
- discovered_at
- discovery_source (openlibrary / wikidata / google / user_search)

### 5.2 editions
- id
- work_id
- isbn10
- isbn13
- publisher
- year
- language
- source

### 5.3 discovery_queue
- id
- query
- type (user_search | global_fill)
- priority (int)
- attempts
- last_attempt_at
- status (pending / found / failed)

### 5.4 search_miss_log
- id
- raw_query
- normalized_query
- user_id (nullable)
- count
- last_seen_at

---

## 6. Очереди и приоритеты

### 6.1 Очередь A — User Search Miss (HIGH PRIORITY)
Источник:
- Все поисковые запросы без результатов

Правила:
- Чем больше `count`, тем выше приоритет
- Нормализация (lowercase, remove stopwords, transliteration)

### 6.2 Очередь B — Global Catalog Fill (LOW PRIORITY)
Источник:
- Wikidata SPARQL выгрузки
- Open Library dumps

Очередь упорядочена:
- По популярности автора
- По году (сначала классика + must-have)
- По отсутствию в базе

---

## 7. Логика Discovery Worker

### 7.1 Основной цикл
1. Взять задачу из очереди (A → B)
2. Определить тип запроса
3. Поиск в источниках:
   - Open Library (primary)
   - Wikidata
   - Google Books (enrich)
4. Normalization & Deduplication
5. Создание / обновление work + editions
6. Обновление статуса очереди

### 7.2 Deduplication
- ISBN → strongest key
- (normalized_title + author + year)
- Wikidata QID
- OpenLibrary Work ID

---

## 8. Разовое формирование исходной глобальной базы книг (Bootstrap)

### 8.1 Назначение
Этот этап выполняется **один раз на старте проекта** (с возможными редкими дополнившими прогонами) и создаёт **исходную каноническую базу всех книг**, по которой далее:
- работают очереди Discovery Worker
- ищутся файлы книг
- происходит постепенное обогащение данных (описания, обложки, файлы, права)

Важно: на этом этапе **не требуется полнота данных**, только минимальный идентификатор книги.

---

### 8.2 Минимальный обязательный набор полей (MVP)
Для каждой книги (work) в исходной базе должны быть:
- title (название)
- normalized_title
- author_name (строкой)
- year (nullable)
- language (nullable)
- external_ids:
  - wikidata_qid (если есть)
  - openlibrary_work_id (если есть)
- bootstrap_source (wikidata / openlibrary)
- bootstrap_at (timestamp)
- status: pending | processed

Этого достаточно, чтобы:
- ставить книгу в очередь
- искать файлы
- дедуплицировать

---

### 8.3 Источник истины для Bootstrap

**Основной источник: Wikidata**
- SPARQL-запрос по сущностям типа `instance of: book`
- Вытаскиваются:
  - название произведения
  - автор (label)
  - год публикации (если есть)
  - язык (если есть)
  - QID

Причина выбора:
- глобальное покрытие
- легально
- удобно строить «список всех существующих книг»

**Дополнение: Open Library Works Dump**
- Используется для:
  - книг, отсутствующих в Wikidata
  - ISBN-связок

---

### 8.4 Bootstrap Pipeline (пошагово)

#### Шаг 1. Массовая выгрузка Wikidata
- Выполняется SPARQL-запрос
- Результат сохраняется в raw-таблицу или файл (JSON/CSV)

#### Шаг 2. Normalization
- Приведение title к normalized_title
- Author → строка (без сложной модели на старте)
- Year → int | null

#### Шаг 3. Deduplication
- По wikidata_qid
- По (normalized_title + author_name + year)

#### Шаг 4. Загрузка в `global_works`
- Создаются записи со статусом `pending`
- Заполняется `bootstrap_source`

---

### 8.5 Размер и ожидания

Оценочно:
- Wikidata: 30–60 млн entities (из них книги — меньшая доля)
- Реально релевантных книг: **10–20 млн**

Это нормально:
- Не все будут обработаны
- Worker работает **лениво и по спросу**

---

### 8.6 Связь с Discovery Worker

После bootstrap:
- **Все книги уже существуют в базе**
- Worker:
  - не создаёт книгу «из воздуха»
  - а обновляет существующую запись

Worker делает:
- поиск файлов
- enrich метаданных
- добавление editions
- смену status → processed

---

### 8.7 Обновление bootstrap базы

Допускаются редкие обновления:
- раз в 6–12 месяцев
- только для добавления новых книг

Новые записи:
- добавляются как `pending`
- автоматически подхватываются очередью

---



## 9. Отметка появления книги в сервисе

При успешном обнаружении:
- `discovered_at = now()`
- `discovery_source = worker_name`
- Привязка к локальной книге Reader.Market

Это позволяет:
- Понимать рост каталога
- Строить метрики покрытия

---

## 10. Метрики
- % Search Miss → Found
- Среднее время нахождения книги
- Покрытие Global Catalog
- Топ-авторы / книги в очереди

---

## 11. Юридические заметки
- Храним **метаданные**, не тексты
- Фиксируем источник
- Для файлов — отдельная система прав

---

## 12. Будущие расширения
- ML-рэнкинг очереди
- Автоматическое связывание переводов
- Связь «work → adaptations»
- Авторитетные авторские профили

---

## 13. Резюме
Этот Worker — фундамент масштабируемого, легального и умного каталога книг.
Он позволяет:
- Реагировать на реальный пользовательский спрос
- Системно покрывать мировой книжный фонд
- Построить долгоживущую базу знаний для Reader.Market

---

## 14. Явные инструкции для реализации (обязательно к выполнению)

### 14.1 Разовая задача: Bootstrap глобальной базы книг

**Цель:**
Единожды сформировать исходную глобальную базу всех книг (`global_works`) с минимальными данными, которая станет основой для всей дальнейшей работы Discovery Worker и очередей.

На этом этапе:
- ❌ не выполняются обогащения
- ❌ не ищутся файлы
- ❌ не запрашиваются внешние API для enrich
- ✅ формируется только «скелет» мира книг

---

### 14.1.1 Источник данных для начального формирования

**Основной источник:** Wikidata (SPARQL endpoint: https://query.wikidata.org/sparql)

**Задача:** получить глобальный список книг по частям, так как невозможно вытянуть всё разом.

#### 14.1.1.1 Логика формирования запросов
1. Используем батчи по алфавиту названия книги или по диапазонам QID.
2. Каждый батч ограничен параметром `LIMIT` (например, 10000 записей) для SPARQL.
3. Прогресс фиксируем с помощью `last_processed_qid` или `last_letter`.
4. Для каждого батча извлекаем поля:
   - title (label)
   - authorLabel (автор)
   - publicationYear (год)
   - languageLabel (язык)
   - wikidata_qid

#### 14.1.1.2 SPARQL-запрос (батч)
```sparql
SELECT ?book ?bookLabel ?authorLabel ?publicationYear ?languageLabel WHERE {
  ?book wdt:P31 wd:Q571 .        # instance of book
  OPTIONAL { ?book wdt:P50 ?author . }
  OPTIONAL { ?book wdt:P577 ?publicationDate . }
  OPTIONAL { ?book wdt:P407 ?language . }

  BIND(year(?publicationDate) AS ?publicationYear)

  FILTER(?book > "<LAST_PROCESSED_QID>"^^wikibase:QID)  # батч после последнего QID

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en".
  }
}
LIMIT 10000
```

#### 14.1.1.3 Логика обработки прогресса
- После каждого батча обновляем `last_processed_qid` в отдельной таблице `bootstrap_progress`.
- Можно отслеживать прогресс как количество обработанных QID и приблизительный процент от общего количества книг (по оценкам Wikidata). 
- Повторный запуск bootstrap-job продолжает с последнего `last_processed_qid`, избегая дублей.

#### 14.1.1.4 Итог
- Система постепенно заполняет `global_works` в итерациях
- Позволяет контролировать прогресс и перезапуск
- Не перегружает endpoint и соблюдает лимиты

### 14.1.2 Как именно запускается Bootstrap (обязательно описать и реализовать)

Bootstrap должен быть **явно управляемым процессом**, а не скрытой логикой.

Допускаются и поддерживаются следующие способы запуска (можно реализовать несколько):

#### Вариант A. Команда в консоли (обязательный минимум)

Пример:
- `npm run bootstrap:global-books`
- или `python manage.py bootstrap_global_books`

Команда:
- запускает импорт Wikidata
- показывает прогресс в логах
- может быть остановлена и перезапущена

---

#### Вариант B. Кнопка в админке (опционально, но желательно)

В админке:
- Раздел: "Глобальный каталог книг"
- Кнопка: **"Сформировать исходную базу книг"**

Поведение кнопки:
- доступна только admin/superadmin
- запускает bootstrap-job асинхронно
- показывает статус:
  - not started
  - running
  - completed
  - failed

---

#### Вариант C. Ручной режим (fallback)

Возможность:
- загрузить подготовленный файл (CSV/JSON)
- запустить импорт через UI или CLI

Используется:
- для тестов
- для частичного перезапуска

---

### 14.1.3 Контроль и безопасность

Во время bootstrap:
- запрещён запуск Discovery Worker
- bootstrap-job должен быть идемпотентным
- повторный запуск не должен создавать дубликаты

Фиксируется:
- время начала
- время окончания
- источник данных
- количество созданных записей

---



### 14.2 Что именно нужно сделать (пошагово)

#### Задача A. Скрипт bootstrap-импорта
Реализовать отдельный скрипт / job (НЕ worker):
- `scripts/bootstrap_global_books.*`

Скрипт делает:
1. Загружает дамп книг из Wikidata (через SPARQL или подготовленный файл)
2. Для каждой записи извлекает:
   - title
   - author_name
   - year
   - wikidata_qid
3. Нормализует данные
4. Делает deduplication
5. Создаёт запись в `global_works` со статусом `pending`

Скрипт запускается **один раз**.

---

#### Задача B. Структура данных
Обязательно создать:
- таблицу `global_works`
- индексы по:
  - wikidata_qid
  - normalized_title + author_name + year

---

#### Задача C. Инвариант системы

Зафиксировать на уровне кода и документации:
- ❌ Worker не создаёт новые works
- ✅ Worker обновляет существующие works
- ❌ Если книга не найдена в `global_works` — это ошибка данных, а не повод создавать новую

---

### 14.3 Админка: контроль глобальной базы и очередей (обязательно)

В существующей админке Reader.Market необходимо добавить **отдельный раздел**, связанный с глобальной базой книг и Discovery Worker.

#### 14.3.1 Раздел "Глобальный каталог книг"
Отображает агрегированную информацию по таблице `global_works`:
- Общее количество книг в базе (все works, независимо от статуса)
- Количество книг:
  - со статусом `pending`
  - со статусом `processed`
- Дата создания bootstrap-базы

Важно:
- На этом экране **НЕ требуется** показывать сами данные книг
- Это именно мониторинг масштаба каталога

---

#### 14.3.2 Раздел "Очереди обработки книг"

Отдельный экран мониторинга очередей Discovery Worker:

Показатели:
- Размер очереди (pending)
- Сколько книг уже обработано (processed)
- Сколько осталось
- Средняя скорость обработки (книг / час)

Дополнительно:
- Разделение по типу очереди:
  - User Search Miss
  - Global Catalog Fill

---

#### 14.3.3 Статистика работы Worker-а

В админке должны быть доступны агрегированные метрики:
- Общее время работы worker-а (c первого запуска)
- Количество обработанных книг за всё время
- Время последней обработки
- Количество ошибок / failed задач

Эти данные могут храниться:
- в отдельной таблице `worker_stats`
- или вычисляться агрегатами из логов

---

### 14.4 Минимальный критерий готовности (Definition of Done)

Система считается готовой, если:
- В `global_works` есть >= N млн записей со статусом `pending`
- Админка показывает:
  - общее количество книг
  - прогресс обработки очередей
- Discovery Worker может взять запись из очереди и:
  - найти метаданные / файлы
  - обновить запись
  - сменить статус на `processed`

---

### 14.5 Почему это сделано именно так

- Прозрачность прогресса
- Контроль масштабной фоновой обработки
- Возможность принимать продуктовые решения на основе данных
- Отсутствие "чёрного ящика" в работе worker-а


---

## 15. Псевдокод Bootstrap Job (reference implementation)

Ниже приведён **референсный псевдокод**, на который Qoder может опираться почти напрямую при реализации.

```pseudo
function bootstrap_global_books():
    assert DiscoveryWorker is STOPPED

    start_time = now()
    log("Bootstrap started", start_time)

    source = "wikidata"
    data_stream = fetch_wikidata_dump()

    for record in data_stream:
        title = normalize_title(record.title)
        author = normalize_author(record.author)
        year = parse_year(record.year)
        qid = record.wikidata_qid

        if exists global_works where wikidata_qid == qid:
            continue

        if exists global_works where normalized_title == title
           and author_name == author
           and year == year:
            continue

        insert into global_works:
            title = record.title
            normalized_title = title
            author_name = author
            year = year
            language = record.language
            wikidata_qid = qid
            bootstrap_source = source
            bootstrap_at = now()
            status = "pending"

    end_time = now()
    log("Bootstrap completed", end_time, count_inserted)
```

Ключевые требования:
- job идемпотентный
- допускает перезапуск
- не создаёт дубликатов

---

## 16. Wikidata SPARQL — базовый запрос книг (copy-paste)

Этот запрос используется для первичного формирования списка книг.

```sparql
SELECT ?book ?bookLabel ?authorLabel ?publicationYear ?languageLabel WHERE {
  ?book wdt:P31 wd:Q571 .        # instance of book
  OPTIONAL { ?book wdt:P50 ?author . }
  OPTIONAL { ?book wdt:P577 ?publicationDate . }
  OPTIONAL { ?book wdt:P407 ?language . }

  BIND(year(?publicationDate) AS ?publicationYear)

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en".
  }
}
LIMIT 100000
```

Примечания:
- LIMIT используется для батчевой загрузки
- запрос должен выполняться постранично
- результат сохраняется в файл или стрим

---

## 17. State Machine книги (Work Lifecycle)

Каждая запись в `global_works` обязана находиться ровно в одном состоянии.

### 17.1 Состояния

- `pending`
  - книга создана bootstrap-ом
  - не обрабатывалась worker-ом

- `processing`
  - книга взята Discovery Worker-ом
  - идёт поиск файлов / метаданных

- `processed`
  - книга успешно обработана
  - добавлены editions / файлы / enrich

- `failed`
  - обработка завершилась ошибкой
  - требуется повторная попытка или ручной анализ

---

### 17.2 Переходы состояний

```
pending → processing → processed
              ↓
            failed
```

Допустимые переходы:
- pending → processing
- processing → processed
- processing → failed
- failed → pending (retry)

Недопустимые:
- processed → pending
- processed → processing

---

### 17.3 Инварианты

- Только Discovery Worker может переводить книгу в `processing`
- Только Worker может ставить `processed` или `failed`
- Bootstrap всегда создаёт книги только со статусом `pending`

---

### 17.4 Отражение в админке

В админке должно отображаться:
- количество книг в каждом состоянии
- скорость перехода pending → processed
- количество failed за период

Это позволяет визуально контролировать прогресс и стабильность системы.


---

## 18. Конкретные источники данных и API (обязательно для реализации)

Этот раздел фиксирует **конкретные сервисы, эндпоинты и правила работы с ними**, используемые:
- при первичном bootstrap глобальной базы книг
- при дальнейшем обновлении и обогащении данных Discovery Worker-ом

Цель: убрать неопределённость «откуда и как брать данные».

---

## 18.1 Wikidata — источник глобального списка книг (bootstrap)

### Назначение
- Формирование **исходного списка всех книг**
- Факт существования произведения

### Доступ
- SPARQL endpoint: `https://query.wikidata.org/sparql`

### Метод
- HTTP GET или POST

### Заголовки
- `Accept: application/sparql+json`
- `User-Agent: Reader.Market/1.0 (contact@reader.market)`

### Запрос
Используется запрос из раздела 16 (батчами).

### Ответ
- JSON
- Поля:
  - book → URI (извлекается QID)
  - bookLabel → title
  - authorLabel → author_name
  - publicationYear → year
  - languageLabel → language

### Сохранение
- Таблица: `global_works`
- Статус: `pending`
- `bootstrap_source = wikidata`

---

## 18.2 Open Library — расширение покрытия и связка ISBN

### Назначение
- Дополнение Wikidata
- Связка works ↔ editions
- ISBN

### Search API
- Endpoint: `https://openlibrary.org/search.json`
- Method: GET

#### Параметры
- `q` — поисковый запрос (title + author)
- `limit` — 100

#### Ответ
- works
- editions
- ISBN-10 / ISBN-13

### Works API
- Endpoint: `https://openlibrary.org/works/{work_id}.json`

### Заголовки
- `Accept: application/json`
- `User-Agent: Reader.Market/1.0`

### Сохранение
- `openlibrary_work_id` → `global_works`
- editions → таблица `editions`

---

## 18.3 Google Books API — enrich (описания, категории, обложки)

### Назначение
- Описания
- Категории
- Обложки

### Endpoint
- `https://www.googleapis.com/books/v1/volumes`

### Метод
- GET

### Заголовки
- `Accept: application/json`

### Параметры
- `q`: `intitle:{title}+inauthor:{author}`
- `maxResults`: 40
- `key`: API_KEY

### Ограничения
- Соблюдать ToS
- Хранить только разрешённые метаданные

### Сохранение
- description
- categories
- thumbnail_url
- source = google_books

---

## 18.4 Internet Archive — метаданные и легальные файлы

### Назначение
- Проверка наличия легальных файлов
- Rights-aware контент

### Advanced Search API
- Endpoint: `https://archive.org/advancedsearch.php`

### Метод
- GET

### Параметры
- `q`: `(title AND creator)`
- `fl[]`: identifier,title,creator,year,rights
- `output`: json

### Item Metadata API
- Endpoint: `https://archive.org/metadata/{identifier}`

### Сохранение
- item identifier
- rights
- formats
- file links (если разрешено)

---

## 18.5 Project Gutenberg — public domain

### Назначение
- Массовое добавление книг в public domain

### Источник
- RDF/XML каталоги
- Локальные дампы

### Метод
- Offline import

### Сохранение
- work → global_works
- editions → editions
- rights = public_domain

---

## 18.6 HathiTrust — enrich по идентификаторам

### Назначение
- Проверка прав
- Дополнение метаданных

### Bibliographic API
- Endpoint: `https://catalog.hathitrust.org/api/volumes/full/{id_type}/{id}`

### Метод
- GET

### Ответ
- JSON
- rights info

---

## 18.7 Crossref — научные книги (ISBN / DOI)

### Endpoint
- `https://api.crossref.org/works`

### Метод
- GET

### Параметры
- `filter=isbn:{isbn}`

### Назначение
- Enrich научных и академических книг

---

## 18.8 Общие правила сохранения данных

- Всегда фиксировать `source`
- Никогда не затирать оригинальные данные
- Хранить timestamps получения данных
- Все внешние данные — через normalizer

---

## 18.9 Обновление данных

- Wikidata:
  - только для bootstrap и редких обновлений
- Остальные источники:
  - только через Discovery Worker
  - по очереди

Это гарантирует:
- воспроизводимость
- юридическую чистоту
- контроль качества данных

