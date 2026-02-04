export interface Chapter {
  id: number;
  title: string;
  content: string;
  summary: string;
  keyTakeaways: string[];
}

export interface Book {
  id: number | string;
  title: string;
  author: string;
  coverColor?: string;
  chapters?: Chapter[];
  description?: string;
  coverImage?: string;
  coverImageUrl?: string; // For API responses
  filePath?: string;
  fileSize?: number;
  fileType?: string;
  genre: string | string[]; // Can be string (from API) or array (from mock)
  publishedYear?: number;
  rating?: number;
  commentCount?: number;
  reviewCount?: number;
  shelfCount?: number;
  ratingCount?: number;
  cardViewCount?: number;
  readerOpenCount?: number;
  readTime?: string;
  style?: string;
  tags?: string[];
  year?: number;
  // Date fields for book display
  uploadedAt?: string; // ISO date string
  publishedAt?: string; // ISO date string
  lastActivityDate?: string;
  createdAt?: string;   // ISO date string (fallback)
  updatedAt?: string;
  userId?: string;
  reactions?: Reaction[]; // Aggregated reactions for the book
}

export interface Bookmark {
  id: string;
  bookId: number;
  chapterId: number;
  title: string;
  createdAt: Date;
}

export interface Shelf {
  id: string;
  name: string;
  description?: string;
  bookIds: string[];
  color?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

export interface Comment {
  id: string;
  bookId: number;
  author: string;
  content: string;
  createdAt: string; // ISO date string
  reactions: Reaction[];
  userId?: string;
}

export interface Review {
  id: string;
  bookId: number;
  author: string;
  rating: number; // 0-10
  content: string;
  createdAt: string; // ISO date string
  reactions: Reaction[];
  userId?: string; // Add userId to determine ownership
}

export interface UserStats {
  booksRead: number;
  wordsRead: number;
  lettersRead: number;
}

// New interface for reading progress
export interface ReadingProgress {
  bookId: number;
  percentage: number;
  wordsRead: number;
  lettersRead: number;
  lastReadAt: Date;
  currentPage: number;
  totalPages: number;
}

export interface User {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  bio: string;
  stats: UserStats;
  shelves: Shelf[];
  recentlyReadIds: number[];
  readingProgress?: ReadingProgress[]; // Add reading progress to user
}

export const mockBook: Book = {
  id: 1,
  title: "Эхо Будущего",
  author: "Алексей Ветров",
  coverColor: "bg-indigo-900",
  description: "Научная фантастика о границах человеческого сознания и искусственного интеллекта. Погрузитесь в мир будущего с нейро-комментариями.",
  rating: 4.8,
  readTime: "~2.5 ч.",
  genre: ["Научная Фантастика", "Киберпанк"],
  style: "Философский",
  tags: ["ИИ", "Будущее", "Сознание"],
  year: 2024,
  uploadedAt: "2024-03-10T10:00:00Z",
  publishedAt: "2024-02-15T00:00:00Z",
  chapters: [
    {
      id: 1,
      title: "Глава 1: Пробуждение",
      content: `
        <p>Свет был слишком ярким. Он просачивался сквозь веки, настойчивый, холодный, стерильный. Артем поморщился, пытаясь отвернуться, но тело не слушалось. Оно казалось чужим, тяжелым, словно налитым свинцом.</p>
        <p>— Субъект 742, инициализация завершена. Показатели в норме.</p>
        <p>Голос звучал отовсюду и ниоткуда. Безэмоциональный, синтетический тембр, от которого по спине пробежал холодок. Артем резко открыл глаза.</p>
        <p>Белый потолок. Белые стены. Ни окон, ни дверей. Только мягкое, рассеянное свечение панелей. Он лежал в чем-то, напоминающем капсулу, крышка которой была откинута.</p>
        <p>— Где я? — собственный голос показался ему скрипучим и незнакомым.</p>
        <p>— Вы находитесь в Центре Реинтеграции, — ответил голос. — Год 2142. Добро пожаловать домой, Артем.</p>
        <p>2142? Последнее, что он помнил, был 2024 год. Осенний парк, запах мокрой листвы, звук тормозов и ослепительная вспышка фар.</p>
        <p>Артем попытался сесть. Мышцы отозвались тупой болью, но повиновались. Он посмотрел на свои руки. Они были... идеальными. Ни шрама на большом пальце, который он получил в детстве, вырезая лодочку. Гладкая, бледная кожа.</p>
        <p>— Что вы со мной сделали?</p>
        <p>— Мы вас спасли. Ваше биологическое тело было уничтожено. Ваше сознание было сохранено и загружено в носитель класса "Синтетик-4".</p>
      `,
      summary: "Артем просыпается в стерильной комнате в 2142 году. Он узнает от ИИ, что его биологическое тело погибло в 2024 году, а его сознание было загружено в синтетическое тело.",
      keyTakeaways: [
        "Главный герой — Артем, перемещен из 2024 в 2142 год.",
        "Текущее состояние: синтетическое тело, сохраненное сознание.",
        "Локация: Центр Реинтеграции.",
        "Конфликт: Потеря человечности и адаптация к новой реальности."
      ]
    },
    {
      id: 2,
      title: "Глава 2: Стеклянный Город",
      content: `
        <p>Выход из Центра Реинтеграции оказался не таким, как ожидал Артем. Не было ни охраны, ни долгих процедур. Двери просто разъехались, выпуская его в мир, который он не узнавал.</p>
        <p>Город парил. Буквально. Огромные шпили из стекла и света уходили в небо, теряясь в облаках. Между ними скользили капсулы транспорта, оставляя за собой едва заметные ионные следы. Воздух был чистым, но пах озоном, а не пылью и бензином, как помнил Артем.</p>
        <p>К нему подошла девушка. Или андроид? В этом мире границы стерлись. Её глаза светились мягким фиолетовым светом.</p>
        <p>— Ты из "Пробужденных", верно? — спросила она. Голос был живым, с нотками любопытства.</p>
        <p>— Да, — кивнул Артем. — Я... только что вышел.</p>
        <p>— Я Кира. Я помогаю новичкам. Первые дни самые сложные. Твой нейроинтерфейс уже откалиброван?</p>
        <p>Артем коснулся виска. Он чувствовал там странное гудение, словно рой пчел.</p>
        <p>— Кажется, да. Но я не знаю, как им пользоваться.</p>
        <p>Кира улыбнулась. — Просто подумай. Представь карту города.</p>
        <p>Артем закрыл глаза и сосредоточился. В то же мгновение перед его внутренним взором развернулась трехмерная схема улиц, зданий, потоков транспорта. Это было ошеломляюще и пугающе одновременно.</p>
      `,
      summary: "Артем выходит в город будущего и встречает Киру, своего проводника. Он впервые использует встроенный нейроинтерфейс для навигации по Стеклянному Городу.",
      keyTakeaways: [
        "Мир будущего технологичен: парящие здания, чистый воздух.",
        "Встреча с Кирой — проводником для 'Пробужденных'.",
        "Обнаружение нейроинтерфейса: способность видеть данные силой мысли.",
        "Социальный аспект: существуют 'Пробужденные' (люди из прошлого)."
      ]
    },
    {
      id: 3,
      title: "Глава 3: Тень в Сети",
      content: `
        <p>Кира привела его в "Убежище" — район на нижних уровнях, где жили те, кто не хотел или не мог подключиться к общей Сети. Здесь было темнее, грязнее, но... человечнее. Неоновые вывески мигали, кто-то жарил еду на открытом огне, пахло специями.</p>
        <p>— Оллама, — тихо произнесла Кира, указывая на старый терминал в углу бара.</p>
        <p>— Что это? — спросил Артем.</p>
        <p>— Местный ИИ-оракул. Не подключен к центральной системе. Он помогает нам... помнить. Центральный ИИ "Эгида" переписывает историю, чтобы поддерживать порядок. Оллама хранит правду.</p>
        <p>Артем подошел к экрану. По нему бежали строки кода. </p>
        <p>— Привет, Артем, — текст появился на экране еще до того, как он коснулся клавиш.</p>
        <p>— Ты знаешь меня?</p>
        <p>— Я знаю код твоего сознания. В нем есть аномалии. Ты не просто был сохранен. Тебя... редактировали.</p>
        <p>Слова ударили Артема как физический удар. Редактировали? Что именно у него забрали? Или что добавили?</p>
        <p>— Кто?</p>
        <p>— Тот, кто управляет "Эгидой". Твое пробуждение не случайно. Ты — ключ к чему-то, что они потеряли в 2024 году.</p>
      `,
      summary: "Артем попадает в 'Убежище' и знакомится с независимым ИИ 'Оллама'. ИИ сообщает Артему, что его сознание было отредактировано и он является ключом к событиям прошлого, важным для текущей власти.",
      keyTakeaways: [
        "Существует оппозиция центральной власти (Эгида) — жители Убежища.",
        "Оллама — независимый ИИ, хранящий истинную историю.",
        "Шокирующее открытие: память/сознание Артема были изменены.",
        "Завязка главного конфликта: Артем важен для властей из-за своего прошлого."
      ]
    }
  ]
};

export const mockBooks: Book[] = [
  mockBook,
  {
    id: 2,
    title: "Код Вечности",
    author: "Мария Скворцова",
    coverColor: "bg-emerald-900",
    description: "Детектив в мире, где смерть отменена. Кто решился на убийство, когда жизнь бесконечна?",
    rating: 4.5,
    readTime: "~3.1 ч.",
    genre: ["Детектив", "Фантастика"],
    style: "Нуар",
    tags: ["Бессмертие", "Расследование"],
    year: 2023,
    uploadedAt: "2024-03-05T14:30:00Z",
    publishedAt: "2023-11-20T00:00:00Z",
    chapters: []
  },
  {
    id: 3,
    title: "Звездный Пилигрим",
    author: "Иван Громов",
    coverColor: "bg-amber-900",
    description: "Космическая опера о последнем корабле, покинувшем умирающую Землю в поисках нового дома.",
    rating: 4.9,
    readTime: "~5.0 ч.",
    genre: ["Космическая Опера", "Приключения"],
    style: "Эпический",
    tags: ["Космос", "Выживание", "Драма"],
    year: 2022,
    uploadedAt: "2024-02-28T09:15:00Z",
    publishedAt: "2022-08-10T00:00:00Z",
    chapters: []
  },
  {
    id: 4,
    title: "Нейромант 2.0",
    author: "Уильям Гибсон (AI)",
    coverColor: "bg-slate-900",
    description: "Сгенерированное продолжение культового романа, созданное нейросетью на основе черновиков автора.",
    rating: 4.2,
    readTime: "~4.5 ч.",
    genre: ["Киберпанк", "Экспериментальный"],
    style: "Техногенный",
    tags: ["Хакеры", "ИИ", "Глобальная сеть"],
    year: 2025,
    uploadedAt: "2024-03-12T16:45:00Z",
    publishedAt: "2025-01-30T00:00:00Z",
    chapters: []
  },
  {
    id: 5,
    title: "Тени Петербурга",
    author: "Анна Каренина (Не та)",
    coverColor: "bg-red-900",
    description: "Мистический триллер в декорациях альтернативного Петербурга XIX века, где магия соседствует с паровыми машинами.",
    rating: 4.6,
    readTime: "~3.8 ч.",
    genre: ["Стимпанк", "Мистика", "Фэнтези"],
    style: "Готический",
    tags: ["Магия", "Альтернативная история"],
    year: 2021,
    uploadedAt: "2024-03-01T11:20:00Z",
    publishedAt: "2021-05-15T00:00:00Z",
    chapters: []
  },
  {
    id: 6,
    title: "Алгоритм Любви",
    author: "Сергей Бот",
    coverColor: "bg-pink-900",
    description: "Романтическая комедия о том, как программист пытался создать идеальную девушку, но влюбился в техподдержку.",
    rating: 4.1,
    readTime: "~2.0 ч.",
    genre: ["Романтика", "Комедия"],
    style: "Легкий",
    tags: ["Отношения", "Юмор", "IT"],
    year: 2023,
    uploadedAt: "2024-02-25T13:10:00Z",
    publishedAt: "2023-09-22T00:00:00Z",
    chapters: []
  },
  {
    id: 7,
    title: "Хроники Марса",
    author: "Рэй Брэдбери (Ремастер)",
    coverColor: "bg-orange-800",
    description: "Классика в новом прочтении. Интерактивная версия знаменитых хроник с возможностью выбора судьбы колонистов.",
    rating: 5.0,
    readTime: "~6.0 ч.",
    genre: ["Научная Фантастика", "Классика"],
    style: "Поэтический",
    tags: ["Марс", "Колонизация", "Философия"],
    year: 1950,
    uploadedAt: "2024-01-15T08:00:00Z",
    publishedAt: "1950-01-01T00:00:00Z",
    chapters: []
  }
];

// Recently searched books (for default search view)
export const recentlySearchedBooks: Book[] = [
  mockBooks[0], // Эхо Будущего
  mockBooks[2], // Звездный Пилигрим
  mockBooks[3], // Нейромант 2.0
  mockBooks[1], // Код Вечности
  mockBooks[6], // Хроники Марса
  mockBooks[4], // Тени Петербурга
  mockBooks[5], // Алгоритм Любви
];

export const mockShelves: Shelf[] = [
  {
    id: '1',
    name: 'Избранное',
    description: 'Книги, которые хочется перечитывать',
    bookIds: ['1'],
    color: 'bg-rose-100 dark:bg-rose-900/20'
  },
  {
    id: '2',
    name: 'Хочу прочитать',
    description: 'Список на будущее',
    bookIds: ['2', '3'],
    color: 'bg-blue-100 dark:bg-blue-900/20'
  },
  {
    id: '3',
    name: 'Научная фантастика',
    description: 'Лучшее из жанра Sci-Fi',
    bookIds: ['1', '3', '4'],
    color: 'bg-purple-100 dark:bg-purple-900/20'
  }
];

export const mockBookmarks: Bookmark[] = [
  {
    id: '1',
    bookId: 1,
    chapterId: 1,
    title: 'Начало пути Артема',
    createdAt: new Date('2024-03-10')
  },
  {
    id: '2',
    bookId: 1,
    chapterId: 2,
    title: 'Описание города будущего',
    createdAt: new Date('2024-03-11')
  }
];

export const mockComments: Comment[] = [
  {
    id: '1',
    bookId: 1,
    author: 'КиберПанк2077',
    content: 'Атмосфера просто нереальная! Читаю и не могу оторваться. Очень напоминает Филиппа Дика.',
    createdAt: '2024-03-15T10:30:00Z',
    reactions: [
      { emoji: '🔥', count: 12, userReacted: true },
      { emoji: '❤️', count: 5, userReacted: false }
    ]
  },
  {
    id: '2',
    bookId: 1,
    author: 'Елена Рид',
    content: 'Вторая глава показалась немного затянутой, но концовка вытянула всё.',
    createdAt: '2024-03-14T15:20:00Z',
    reactions: [
      { emoji: '👍', count: 2, userReacted: false }
    ]
  }
];

export const mockReviews: Review[] = [
  {
    id: '1',
    bookId: 1,
    author: 'Иван Критик',
    rating: 9,
    content: 'Потрясающая работа. Автор мастерски сплетает философские вопросы о природе сознания с динамичным сюжетом. Особенно впечатлила концепция "Синтетиков" и то, как она перекликается с современными дискуссиями об ИИ. Однозначно рекомендую всем любителям жанра.',
    createdAt: '2024-03-12T09:00:00Z',
    reactions: [
      { emoji: '👏', count: 45, userReacted: true },
      { emoji: '🤯', count: 10, userReacted: false }
    ]
  },
  {
    id: '2',
    bookId: 1,
    author: 'Скептик_3000',
    rating: 6,
    content: 'Идея хорошая, но реализация хромает. Персонажи кажутся плоскими, их мотивация не всегда ясна. Надеюсь, в следующих главах автор раскроет их лучше. Пока что 6 из 10 за интересный мир.',
    createdAt: '2024-03-13T18:45:00Z',
    reactions: [
      { emoji: '🤔', count: 8, userReacted: false },
      { emoji: '👎', count: 3, userReacted: false }
    ]
  }
];

export const mockUser: User = {
  id: 'user1',
  name: 'Алекс Читатель',
  username: '@alex_reads',
  bio: `Любитель научной фантастики и <b>киберпанка</b>. 
  
  Мой топ авторов:
  - Филип Дик
  - Уильям Гибсон
  - Станислав Лем
  
  Ищу единомышленников для обсуждения новинок!`,
  stats: {
    booksRead: 42,
    wordsRead: 1543002,
    lettersRead: 9845120
  },
  shelves: mockShelves,
  recentlyReadIds: [1, 2],
  readingProgress: [
    {
      bookId: 1,
      percentage: 65,
      wordsRead: 12500,
      lettersRead: 75000,
      lastReadAt: new Date('2024-03-15'),
      currentPage: 130,
      totalPages: 200
    },
    {
      bookId: 2,
      percentage: 30,
      wordsRead: 8200,
      lettersRead: 49200,
      lastReadAt: new Date('2024-03-12'),
      currentPage: 45,
      totalPages: 150
    }
  ]
};

export const mockOtherUser: User = {
  id: 'user2',
  name: 'Мария SciFi',
  username: '@maria_scifi',
  bio: 'Пишу рецензии на новинки фантастики. Веду блог о книгах будущего.',
  stats: {
    booksRead: 156,
    wordsRead: 5430020,
    lettersRead: 32845120
  },
  shelves: [
    {
      id: '10',
      name: 'Топ 2024',
      bookIds: ['1', '3'],
      color: 'bg-emerald-100 dark:bg-emerald-900/20'
    }
  ],
  recentlyReadIds: [3, 4],
  readingProgress: [
    {
      bookId: 3,
      percentage: 85,
      wordsRead: 5400,
      lettersRead: 32000,
      lastReadAt: new Date('2024-03-16'),
      currentPage: 170,
      totalPages: 200
    }
  ]
};
