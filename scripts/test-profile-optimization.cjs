const puppeteer = require('puppeteer');

async function testProfileOptimization() {
  let browser;
  try {
    console.log('=== Testing Profile Page Reading Progress Optimization ===\n');
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Set to true for headless mode
      slowMo: 50,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Enable request interception to monitor network requests
    await page.setRequestInterception(true);
    
    // Track reading progress requests
    let readingProgressRequests = [];
    
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/books/') && url.includes('/reading-progress')) {
        readingProgressRequests.push({
          url: url,
          method: request.method(),
          timestamp: new Date().toISOString()
        });
        console.log(`📊 Reading progress request detected: ${url}`);
      }
      request.continue();
    });
    
    // Navigate to profile page
    console.log('Navigating to profile page...');
    await page.goto('http://localhost:3001/profile/WizardJIOCb', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for page to load completely
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log(`\nTotal reading progress requests detected: ${readingProgressRequests.length}`);
    
    if (readingProgressRequests.length === 0) {
      console.log('✅ SUCCESS: No reading progress requests detected!');
      console.log('   The optimization is working correctly.');
    } else {
      console.log('❌ ISSUE: Still detecting reading progress requests:');
      readingProgressRequests.forEach((req, index) => {
        console.log(`   ${index + 1}. ${req.method} ${req.url}`);
      });
      
      // Check if these are the optimized requests (should be much fewer)
      if (readingProgressRequests.length < 5) {
        console.log('\n⚠️  PARTIAL SUCCESS: Fewer requests detected, but still some remain');
        console.log('   This suggests the optimization is partially working');
      } else {
        console.log('\n❌ FAILURE: Many reading progress requests still being made');
        console.log('   The optimization may not be fully implemented or working');
      }
    }
    
    // Take screenshot for visual verification
    await page.screenshot({ 
      path: 'profile-optimization-test.png', 
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as profile-optimization-test.png');
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testProfileOptimization();