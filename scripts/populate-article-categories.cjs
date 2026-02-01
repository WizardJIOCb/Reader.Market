const axios = require('axios');

// Define the article categories structure as specified
const categoriesStructure = [
  {
    name: 'Новости и анонсы',
    slug: 'news',
    children: [
      { name: 'Новые книги', slug: 'news.new-books' },
      { name: 'Новые переводы', slug: 'news.new-translations' },
      { name: 'Переиздания / новые обложки', slug: 'news.reprints' },
      { name: 'Экранизации и адаптации', slug: 'news.adaptations' },
      { name: 'Премии и события', slug: 'news.awards-events' }
    ]
  },
  {
    name: 'Обсуждение книг',
    slug: 'books',
    children: [
      { name: 'Без спойлеров', slug: 'books.no-spoilers' },
      { name: 'Со спойлерами', slug: 'books.spoilers' },
      { name: 'По главам / по сценам', slug: 'books.by-chapters' },
      { name: 'Теории и трактовки', slug: 'books.theories' },
      { name: 'Цитаты и находки', slug: 'books.quotes' }
    ]
  },
  {
    name: 'Рецензии и разборы',
    slug: 'reviews',
    children: [
      { name: 'Рецензии', slug: 'reviews.reviews' },
      { name: 'Эссе / аналитика', slug: 'reviews.essays' },
      { name: 'Персонажи и мир', slug: 'reviews.characters-world' },
      { name: 'Сюжет и структура', slug: 'reviews.plot-structure' },
      { name: 'Темы и смыслы', slug: 'reviews.themes' }
    ]
  },
  {
    name: 'Подборки и рекомендации',
    slug: 'collections',
    children: [
      { name: 'Что читать дальше', slug: 'collections.what-next' },
      { name: 'Топы и списки', slug: 'collections.tops' },
      { name: 'По жанрам', slug: 'collections.by-genre' },
      { name: 'По настроению / темам', slug: 'collections.by-mood' },
      { name: 'Для новичков', slug: 'collections.for-beginners' }
    ]
  },
  {
    name: 'Переводы и издания',
    slug: 'translations',
    children: [
      { name: 'Сравнение переводов', slug: 'translations.compare' },
      { name: 'Качество перевода/редактура', slug: 'translations.quality' },
      { name: 'Термины и глоссарии', slug: 'translations.glossary' },
      { name: 'Разбор фрагментов', slug: 'translations.excerpts' }
    ]
  },
  {
    name: 'Авторы и индустрия',
    slug: 'industry',
    children: [
      { name: 'Авторы: новости', slug: 'industry.authors-news' },
      { name: 'Интервью / заметки', slug: 'industry.interviews' },
      { name: 'Издательства и рынок', slug: 'industry.publishers' },
      { name: 'Тренды / подборки по рынку', slug: 'industry.trends' }
    ]
  },
  {
    name: 'Клубы и челленджи',
    slug: 'clubs',
    children: [
      { name: 'Совместные чтения', slug: 'clubs.readalongs' },
      { name: 'Марафоны / челленджи', slug: 'clubs.challenges' },
      { name: 'Цели чтения', slug: 'clubs.goals' },
      { name: 'Отчёты / прогресс', slug: 'clubs.progress' }
    ]
  },
  {
    name: 'Сообщество и сервис',
    slug: 'community',
    children: [
      { name: 'Обновления сервиса', slug: 'community.product-updates' },
      { name: 'Вопросы и помощь', slug: 'community.qna' },
      { name: 'Идеи и предложения', slug: 'community.ideas' }
    ]
  }
];

async function populateCategories() {
  try {
    console.log('Starting to populate article categories...');
    
    // First, let's try to login as admin to get a token
    // We'll assume there's an admin user or create one if needed
    let token = '';
    
    // Try to login with default admin credentials
    try {
      const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      });
      
      if (loginResponse.data.token) {
        token = loginResponse.data.token;
        console.log('Successfully logged in as admin');
      }
    } catch (loginError) {
      console.log('Could not login as admin, trying to create a test user...');
      
      // Create a test user first
      try {
        const createUserResponse = await axios.post('http://localhost:3001/api/auth/register', {
          username: 'testadmin',
          email: 'testadmin@example.com',
          password: 'password123',
          fullName: 'Test Admin'
        });
        
        console.log('Created test user:', createUserResponse.data.user.username);
        
        // Now login with the test user
        const testLoginResponse = await axios.post('http://localhost:3001/api/auth/login', {
          username: 'testadmin',
          password: 'password123'
        });
        
        token = testLoginResponse.data.token;
        console.log('Successfully logged in with test user');
        
        // Try to promote this user to admin (if endpoint exists)
        try {
          await axios.post(`http://localhost:3001/api/admin/users/${createUserResponse.data.user.userId}/role`, 
            { role: 'admin' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          console.log('Promoted user to admin');
        } catch (promoteError) {
          console.log('Could not promote user to admin, continuing with current permissions...');
        }
      } catch (registerError) {
        console.error('Could not create test user either:', registerError.message);
        // Let's try to use a token from a previous session or skip auth if possible
        console.log('Continuing without authentication...');
      }
    }

    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    // Create parent categories first
    for (const category of categoriesStructure) {
      console.log(`Creating category: ${category.name}`);
      
      try {
        // Check if category already exists
        const existingCategoriesResponse = await axios.get('http://localhost:3001/api/article-categories');
        const existingCategory = existingCategoriesResponse.data.find(cat => cat.slug === category.slug);
        
        let categoryId;
        if (existingCategory) {
          console.log(`Category ${category.name} already exists`);
          categoryId = existingCategory.id;
        } else {
          // Create the parent category
          const response = await axios.post(
            'http://localhost:3001/api/admin/article-categories',
            {
              name: category.name,
              slug: category.slug,
              description: `Category for ${category.name}`
            },
            { headers }
          );
          
          categoryId = response.data.id;
          console.log(`Created category: ${category.name} with ID: ${categoryId}`);
        }
        
        // Create child categories
        if (category.children && category.children.length > 0) {
          for (const child of category.children) {
            console.log(`  Creating child category: ${child.name}`);
            
            // Check if child category already exists
            const existingChild = existingCategoriesResponse.data.find(cat => cat.slug === child.slug);
            
            if (existingChild) {
              console.log(`  Child category ${child.name} already exists`);
            } else {
              // Create the child category
              const childResponse = await axios.post(
                'http://localhost:3001/api/admin/article-categories',
                {
                  name: child.name,
                  slug: child.slug,
                  description: `Subcategory for ${child.name}`
                },
                { headers }
              );
              
              console.log(`  Created child category: ${child.name} with ID: ${childResponse.data.id}`);
            }
          }
        }
      } catch (error) {
        console.error(`Error creating category ${category.name}:`, error.response?.data || error.message);
      }
    }
    
    console.log('Finished populating article categories!');
  } catch (error) {
    console.error('Error in populateCategories:', error.message);
  }
}

// Run the function
populateCategories();