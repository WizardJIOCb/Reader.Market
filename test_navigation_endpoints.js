// Test navigation endpoints
const token = localStorage.getItem('authToken');

if (!token) {
  console.error('No auth token found!');
} else {
  console.log('Testing navigation endpoints...');
  
  const pages = ['home', 'stream', 'search', 'shelves', 'messages'];
  
  pages.forEach(async (page) => {
    try {
      const response = await fetch(`http://localhost:5001/api/${page}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${page}:`, data);
      } else {
        console.error(`❌ ${page}:`, response.status, response.statusText);
      }
    } catch (error) {
      console.error(`❌ ${page} error:`, error);
    }
  });
}
