import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { articleCategories } from '../shared/schema.js';

// Database connection
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'reader_market_dev',
  user: 'postgres',
  password: 'postgres',
});

const db = drizzle(pool);

// Define the article categories structure as specified
const categoriesStructure = [
  {
    title: 'Новости и анонсы',
    slug: 'news',
    sortOrder: 1
  },
  {
    title: 'Обсуждение книг',
    slug: 'books',
    sortOrder: 2
  },
  {
    title: 'Рецензии и разборы',
    slug: 'reviews',
    sortOrder: 3
  },
  {
    title: 'Подборки и рекомендации',
    slug: 'collections',
    sortOrder: 4
  },
  {
    title: 'Переводы и издания',
    slug: 'translations',
    sortOrder: 5
  },
  {
    title: 'Авторы и индустрия',
    slug: 'industry',
    sortOrder: 6
  },
  {
    title: 'Клубы и челленджи',
    slug: 'clubs',
    sortOrder: 7
  },
  {
    title: 'Сообщество и сервис',
    slug: 'community',
    sortOrder: 8
  }
];

// Subcategories
const subcategories = [
  // News subcategories
  { title: 'Новые книги', slug: 'news.new-books', sortOrder: 101 },
  { title: 'Новые переводы', slug: 'news.new-translations', sortOrder: 102 },
  { title: 'Переиздания / новые обложки', slug: 'news.reprints', sortOrder: 103 },
  { title: 'Экранизации и адаптации', slug: 'news.adaptations', sortOrder: 104 },
  { title: 'Премии и события', slug: 'news.awards-events', sortOrder: 105 },

  // Books subcategories
  { title: 'Без спойлеров', slug: 'books.no-spoilers', sortOrder: 201 },
  { title: 'Со спойлерами', slug: 'books.spoilers', sortOrder: 202 },
  { title: 'По главам / по сценам', slug: 'books.by-chapters', sortOrder: 203 },
  { title: 'Теории и трактовки', slug: 'books.theories', sortOrder: 204 },
  { title: 'Цитаты и находки', slug: 'books.quotes', sortOrder: 205 },

  // Reviews subcategories
  { title: 'Рецензии', slug: 'reviews.reviews', sortOrder: 301 },
  { title: 'Эссе / аналитика', slug: 'reviews.essays', sortOrder: 302 },
  { title: 'Персонажи и мир', slug: 'reviews.characters-world', sortOrder: 303 },
  { title: 'Сюжет и структура', slug: 'reviews.plot-structure', sortOrder: 304 },
  { title: 'Темы и смыслы', slug: 'reviews.themes', sortOrder: 305 },

  // Collections subcategories
  { title: 'Что читать дальше', slug: 'collections.what-next', sortOrder: 401 },
  { title: 'Топы и списки', slug: 'collections.tops', sortOrder: 402 },
  { title: 'По жанрам', slug: 'collections.by-genre', sortOrder: 403 },
  { title: 'По настроению / темам', slug: 'collections.by-mood', sortOrder: 404 },
  { title: 'Для новичков', slug: 'collections.for-beginners', sortOrder: 405 },

  // Translations subcategories
  { title: 'Сравнение переводов', slug: 'translations.compare', sortOrder: 501 },
  { title: 'Качество перевода/редактура', slug: 'translations.quality', sortOrder: 502 },
  { title: 'Термины и глоссарии', slug: 'translations.glossary', sortOrder: 503 },
  { title: 'Разбор фрагментов', slug: 'translations.excerpts', sortOrder: 504 },

  // Industry subcategories
  { title: 'Авторы: новости', slug: 'industry.authors-news', sortOrder: 601 },
  { title: 'Интервью / заметки', slug: 'industry.interviews', sortOrder: 602 },
  { title: 'Издательства и рынок', slug: 'industry.publishers', sortOrder: 603 },
  { title: 'Тренды / подборки по рынку', slug: 'industry.trends', sortOrder: 604 },

  // Clubs subcategories
  { title: 'Совместные чтения', slug: 'clubs.readalongs', sortOrder: 701 },
  { title: 'Марафоны / челленджи', slug: 'clubs.challenges', sortOrder: 702 },
  { title: 'Цели чтения', slug: 'clubs.goals', sortOrder: 703 },
  { title: 'Отчёты / прогресс', slug: 'clubs.progress', sortOrder: 704 },

  // Community subcategories
  { title: 'Обновления сервиса', slug: 'community.product-updates', sortOrder: 801 },
  { title: 'Вопросы и помощь', slug: 'community.qna', sortOrder: 802 },
  { title: 'Идеи и предложения', slug: 'community.ideas', sortOrder: 803 }
];

async function insertCategories() {
  try {
    console.log('Connecting to database and inserting article categories...');
    
    // First, let's check if categories already exist to avoid duplicates
    const existingCategories = await db.select().from(articleCategories);
    
    if (existingCategories.length > 0) {
      console.log(`Found ${existingCategories.length} existing categories. Skipping insertion.`);
      return;
    }
    
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
    
    await pool.end();
  } catch (error) {
    console.error('Error inserting categories:', error);
    await pool.end();
  }
}

// Run the function
insertCategories();