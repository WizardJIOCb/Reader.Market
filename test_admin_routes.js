const axios = require('axios');

async function testAdminRoutes() {
  const baseUrl = 'http://localhost:5001';
  
  // Ваши токены доступа здесь
  const token = process.env.ADMIN_TOKEN; // или получите токен через логин
  
  if (!token) {
    console.log('Требуется токен администратора для тестирования маршрутов');
    return;
  }
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  console.log('Тестируем админ-маршруты...');
  
  try {
    // Проверяем каждый маршрут
    const routes = [
      { method: 'GET', path: '/api/admin/dashboard-stats' },
      { method: 'GET', path: '/api/admin/news' },
      { method: 'GET', path: '/api/admin/articles' },
      { method: 'GET', path: '/api/admin/article-categories' },
      { method: 'GET', path: '/api/admin/books?page=1&limit=20&sortBy=uploadedAt&sortOrder=desc' },
      { method: 'GET', path: '/api/tts/admin/cache-stats' },
      { method: 'GET', path: '/api/tts/admin/config' }
    ];
    
    for (const route of routes) {
      try {
        const url = `${baseUrl}${route.path}`;
        console.log(`Тестируем ${route.method} ${route.path}...`);
        
        const response = await axios({
          method: route.method,
          url: url,
          headers: headers
        });
        
        console.log(`✓ ${route.method} ${route.path}: ${response.status} - ${typeof response.data}`);
        
        if (typeof response.data === 'object') {
          console.log(`  Ответ:`, JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
        }
      } catch (error) {
        if (error.response) {
          console.log(`✗ ${route.method} ${route.path}: ${error.response.status} -`, error.response.data?.error || error.response.statusText);
        } else {
          console.log(`✗ ${route.method} ${route.path}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Ошибка при тестировании маршрутов:', error.message);
  }
}

testAdminRoutes();