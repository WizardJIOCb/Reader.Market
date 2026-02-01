import 'dotenv/config';
import { db } from '../server/storage.js';
import { articleCategories } from '../shared/schema.js';

// Define the article categories structure as specified with Russian and English names and descriptions
const categoriesStructure = [
  {
    title: 'Новости и анонсы',
    titleEn: 'News and Announcements',
    description: 'Новости о литературе, анонсы новых книг, переводов и событий',
    descriptionEn: 'Literary news, announcements of new books, translations and events',
    slug: 'news',
    sortOrder: 1
  },
  {
    title: 'Обсуждение книг',
    titleEn: 'Book Discussions',
    description: 'Обсуждение книг, без спойлеров и со спойлерами',
    descriptionEn: 'Book discussions, with and without spoilers',
    slug: 'books',
    sortOrder: 2
  },
  {
    title: 'Рецензии и разборы',
    titleEn: 'Reviews and Analysis',
    description: 'Рецензии на книги и их подробный разбор',
    descriptionEn: 'Book reviews and detailed analysis',
    slug: 'reviews',
    sortOrder: 3
  },
  {
    title: 'Подборки и рекомендации',
    titleEn: 'Collections and Recommendations',
    description: 'Лучшие книги по различным критериям',
    descriptionEn: 'Best books according to various criteria',
    slug: 'collections',
    sortOrder: 4
  },
  {
    title: 'Переводы и издания',
    titleEn: 'Translations and Editions',
    description: 'Сравнение переводов и информация об изданиях',
    descriptionEn: 'Translation comparison and edition information',
    slug: 'translations',
    sortOrder: 5
  },
  {
    title: 'Авторы и индустрия',
    titleEn: 'Authors and Industry',
    description: 'Новости об авторах и книжной индустрии',
    descriptionEn: 'News about authors and the book industry',
    slug: 'industry',
    sortOrder: 6
  },
  {
    title: 'Клубы и челленджи',
    titleEn: 'Clubs and Challenges',
    description: 'Книжные клубы и чтения',
    descriptionEn: 'Book clubs and reading challenges',
    slug: 'clubs',
    sortOrder: 7
  },
  {
    title: 'Сообщество и сервис',
    titleEn: 'Community and Service',
    description: 'Обновления сервиса и общение в сообществе',
    descriptionEn: 'Service updates and community interaction',
    slug: 'community',
    sortOrder: 8
  }
];

// Subcategories with Russian and English names and descriptions
const subcategories = [
  // News subcategories
  { 
    title: 'Новые книги', 
    titleEn: 'New Books',
    description: 'Анонсы новых книг',
    descriptionEn: 'Announcements of new books',
    slug: 'news.new-books', 
    sortOrder: 101 
  },
  { 
    title: 'Новые переводы', 
    titleEn: 'New Translations',
    description: 'Новые переводы книг',
    descriptionEn: 'New book translations',
    slug: 'news.new-translations', 
    sortOrder: 102 
  },
  { 
    title: 'Переиздания / новые обложки', 
    titleEn: 'Reissues / New Covers',
    description: 'Переиздания книг и новые обложки',
    descriptionEn: 'Book reissues and new covers',
    slug: 'news.reprints', 
    sortOrder: 103 
  },
  { 
    title: 'Экранизации и адаптации', 
    titleEn: 'Adaptations and Screenings',
    description: 'Экранизации книг и другие адаптации',
    descriptionEn: 'Book adaptations to film and other media',
    slug: 'news.adaptations', 
    sortOrder: 104 
  },
  { 
    title: 'Премии и события', 
    titleEn: 'Awards and Events',
    description: 'Литературные премии и события',
    descriptionEn: 'Literary awards and events',
    slug: 'news.awards-events', 
    sortOrder: 105 
  },

  // Books subcategories
  { 
    title: 'Без спойлеров', 
    titleEn: 'No Spoilers',
    description: 'Обсуждение книг без спойлеров',
    descriptionEn: 'Book discussion without spoilers',
    slug: 'books.no-spoilers', 
    sortOrder: 201 
  },
  { 
    title: 'Со спойлерами', 
    titleEn: 'With Spoilers',
    description: 'Обсуждение книг со спойлерами',
    descriptionEn: 'Book discussion with spoilers',
    slug: 'books.spoilers', 
    sortOrder: 202 
  },
  { 
    title: 'По главам / по сценам', 
    titleEn: 'By Chapters / Scenes',
    description: 'Обсуждение по главам или сценам',
    descriptionEn: 'Discussion by chapters or scenes',
    slug: 'books.by-chapters', 
    sortOrder: 203 
  },
  { 
    title: 'Теории и трактовки', 
    titleEn: 'Theories and Interpretations',
    description: 'Теории и интерпретации произведений',
    descriptionEn: 'Theories and interpretations of works',
    slug: 'books.theories', 
    sortOrder: 204 
  },
  { 
    title: 'Цитаты и находки', 
    titleEn: 'Quotes and Finds',
    description: 'Интересные цитаты и литературные находки',
    descriptionEn: 'Interesting quotes and literary discoveries',
    slug: 'books.quotes', 
    sortOrder: 205 
  },

  // Reviews subcategories
  { 
    title: 'Рецензии', 
    titleEn: 'Reviews',
    description: 'Рецензии на книги',
    descriptionEn: 'Book reviews',
    slug: 'reviews.reviews', 
    sortOrder: 301 
  },
  { 
    title: 'Эссе / аналитика', 
    titleEn: 'Essays / Analytics',
    description: 'Аналитические эссе о книгах',
    descriptionEn: 'Analytical essays about books',
    slug: 'reviews.essays', 
    sortOrder: 302 
  },
  { 
    title: 'Персонажи и мир', 
    titleEn: 'Characters and World',
    description: 'Разбор персонажей и мира произведения',
    descriptionEn: 'Analysis of characters and world of the work',
    slug: 'reviews.characters-world', 
    sortOrder: 303 
  },
  { 
    title: 'Сюжет и структура', 
    titleEn: 'Plot and Structure',
    description: 'Разбор сюжета и структуры произведения',
    descriptionEn: 'Analysis of plot and structure of the work',
    slug: 'reviews.plot-structure', 
    sortOrder: 304 
  },
  { 
    title: 'Темы и смыслы', 
    titleEn: 'Themes and Meanings',
    description: 'Разбор тем и смыслов произведения',
    descriptionEn: 'Analysis of themes and meanings of the work',
    slug: 'reviews.themes', 
    sortOrder: 305 
  },

  // Collections subcategories
  { 
    title: 'Что читать дальше', 
    titleEn: 'What to Read Next',
    description: 'Рекомендации по выбору следующей книги',
    descriptionEn: 'Recommendations for choosing your next book',
    slug: 'collections.what-next', 
    sortOrder: 401 
  },
  { 
    title: 'Топы и списки', 
    titleEn: 'Top Lists',
    description: 'Топы и списки книг',
    descriptionEn: 'Top lists of books',
    slug: 'collections.tops', 
    sortOrder: 402 
  },
  { 
    title: 'По жанрам', 
    titleEn: 'By Genres',
    description: 'Книги по жанрам',
    descriptionEn: 'Books by genres',
    slug: 'collections.by-genre', 
    sortOrder: 403 
  },
  { 
    title: 'По настроению / темам', 
    titleEn: 'By Mood / Themes',
    description: 'Книги по настроению и темам',
    descriptionEn: 'Books by mood and themes',
    slug: 'collections.by-mood', 
    sortOrder: 404 
  },
  { 
    title: 'Для новичков', 
    titleEn: 'For Beginners',
    description: 'Рекомендации для начинающих читателей',
    descriptionEn: 'Recommendations for beginner readers',
    slug: 'collections.for-beginners', 
    sortOrder: 405 
  },

  // Translations subcategories
  { 
    title: 'Сравнение переводов', 
    titleEn: 'Translation Comparison',
    description: 'Сравнение различных переводов одного произведения',
    descriptionEn: 'Comparison of different translations of the same work',
    slug: 'translations.compare', 
    sortOrder: 501 
  },
  { 
    title: 'Качество перевода/редактура', 
    titleEn: 'Translation Quality/Edit',
    description: 'Оценка качества перевода и редактуры',
    descriptionEn: 'Assessment of translation and editing quality',
    slug: 'translations.quality', 
    sortOrder: 502 
  },
  { 
    title: 'Термины и глоссарии', 
    titleEn: 'Terms and Glossaries',
    description: 'Специальные термины и глоссарии переводов',
    descriptionEn: 'Special terms and glossaries in translations',
    slug: 'translations.glossary', 
    sortOrder: 503 
  },
  { 
    title: 'Разбор фрагментов', 
    titleEn: 'Fragment Analysis',
    description: 'Детальный разбор фрагментов текста',
    descriptionEn: 'Detailed analysis of text fragments',
    slug: 'translations.excerpts', 
    sortOrder: 504 
  },

  // Industry subcategories
  { 
    title: 'Авторы: новости', 
    titleEn: 'Authors: News',
    description: 'Новости о литературных авторах',
    descriptionEn: 'News about literary authors',
    slug: 'industry.authors-news', 
    sortOrder: 601 
  },
  { 
    title: 'Интервью / заметки', 
    titleEn: 'Interviews / Notes',
    description: 'Интервью с авторами и заметки о них',
    descriptionEn: 'Interviews with authors and notes about them',
    slug: 'industry.interviews', 
    sortOrder: 602 
  },
  { 
    title: 'Издательства и рынок', 
    titleEn: 'Publishers and Market',
    description: 'Новости издательств и книжного рынка',
    descriptionEn: 'News about publishers and the book market',
    slug: 'industry.publishers', 
    sortOrder: 603 
  },
  { 
    title: 'Тренды / подборки по рынку', 
    titleEn: 'Market Trends / Selections',
    description: 'Тренды книжного рынка и подборки',
    descriptionEn: 'Book market trends and selections',
    slug: 'industry.trends', 
    sortOrder: 604 
  },

  // Clubs subcategories
  { 
    title: 'Совместные чтения', 
    titleEn: 'Joint Reading',
    description: 'Организация совместных чтений',
    descriptionEn: 'Organization of joint reading sessions',
    slug: 'clubs.readalongs', 
    sortOrder: 701 
  },
  { 
    title: 'Марафоны / челленджи', 
    titleEn: 'Marathons / Challenges',
    description: 'Чтение марафоны и челленджи',
    descriptionEn: 'Reading marathons and challenges',
    slug: 'clubs.challenges', 
    sortOrder: 702 
  },
  { 
    title: 'Цели чтения', 
    titleEn: 'Reading Goals',
    description: 'Постановка целей по чтению',
    descriptionEn: 'Setting reading goals',
    slug: 'clubs.goals', 
    sortOrder: 703 
  },
  { 
    title: 'Отчёты / прогресс', 
    titleEn: 'Reports / Progress',
    description: 'Отчеты о чтении и прогрессе',
    descriptionEn: 'Reading reports and progress tracking',
    slug: 'clubs.progress', 
    sortOrder: 704 
  },

  // Community subcategories
  { 
    title: 'Обновления сервиса', 
    titleEn: 'Service Updates',
    description: 'Обновления и изменения в сервисе',
    descriptionEn: 'Updates and changes to the service',
    slug: 'community.product-updates', 
    sortOrder: 801 
  },
  { 
    title: 'Вопросы и помощь', 
    titleEn: 'Questions and Help',
    description: 'Вопросы пользователей и помощь',
    descriptionEn: 'User questions and assistance',
    slug: 'community.qna', 
    sortOrder: 802 
  },
  { 
    title: 'Идеи и предложения', 
    titleEn: 'Ideas and Suggestions',
    description: 'Идеи и предложения по улучшению сервиса',
    descriptionEn: 'Ideas and suggestions for service improvement',
    slug: 'community.ideas', 
    sortOrder: 803 
  }
];

async function insertCategories() {
  try {
    console.log('Connecting to database and inserting article categories...');
    
    // First, let's delete any existing categories to start fresh
    await db.delete(articleCategories);
    console.log('Deleted existing categories.');
    
    // Insert main categories
    console.log('Inserting main categories...');
    const mainCategoryResults = await db.insert(articleCategories)
      .values(categoriesStructure)
      .returning();
    
    console.log(`Inserted ${mainCategoryResults.length} main categories.`);
    
    // Insert subcategories
    console.log('Inserting subcategories...');
    const subcategoryResults = await db.insert(articleCategories)
      .values(subcategories)
      .returning();
    
    console.log(`Inserted ${subcategoryResults.length} subcategories.`);
    
    console.log('All categories have been successfully inserted!');
    
    // Fetch and display all categories to confirm
    const allCategories = await db.select()
      .from(articleCategories)
      .orderBy(articleCategories.sortOrder);
    
    console.log('\nCurrent categories in database:');
    allCategories.forEach(cat => {
      console.log(`- ${cat.title} (${cat.slug})`);
    });
  } catch (error) {
    console.error('Error inserting categories:', error);
  }
}

// Run the function
await insertCategories();