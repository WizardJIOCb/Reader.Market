// Emergency console test - run this in browser console
// This bypasses all React components and logging systems

(function emergencyConsoleTest() {
  console.warn('=== EMERGENCY CONSOLE TEST STARTED ===');
  
  // Test 1: Basic console functionality
  console.log('[TEST-1] Basic console.log working');
  console.info('[TEST-1] Basic console.info working');
  console.warn('[TEST-1] Basic console.warn working');
  console.error('[TEST-1] Basic console.error working');
  console.debug('[TEST-1] Basic console.debug working');
  
  // Test 2: Check if we're in the right context
  console.warn('[TEST-2] Window location:', window.location.href);
  console.warn('[TEST-2] Document title:', document.title);
  console.warn('[TEST-2] User agent:', navigator.userAgent);
  
  // Test 3: Try to access the TTS admin page directly
  console.warn('[TEST-3] Attempting to verify we are on TTS admin page...');
  
  // Look for specific elements that should be on the TTS admin page
  const ttsElements = document.querySelectorAll('[class*="tts"], [id*="tts"], [data-testid*="tts"]');
  console.warn('[TEST-3] Found TTS-related elements:', ttsElements.length);
  
  // Check if we can find the TTS admin settings component
  const adminPanels = document.querySelectorAll('.card, .panel, [role="tabpanel"]');
  console.warn('[TEST-3] Found admin panels:', adminPanels.length);
  
  // Test 4: Try to manually trigger a fetch to the TTS API
  console.warn('[TEST-4] Testing direct API call...');
  
  const authToken = localStorage.getItem('authToken');
  console.warn('[TEST-4] Auth token present:', !!authToken);
  
  if (authToken) {
    fetch('/api/tts/admin/config', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    })
    .then(response => {
      console.warn('[TEST-4] API Response status:', response.status);
      return response.json();
    })
    .then(data => {
      console.warn('[TEST-4] API Response data:', data);
    })
    .catch(error => {
      console.error('[TEST-4] API Error:', error);
    });
  }
  
  // Test 5: Check if React is loaded
  console.warn('[TEST-5] React version (if available):', window.React?.version);
  console.warn('[TEST-5] ReactDOM version (if available):', window.ReactDOM?.version);
  
  // Test 6: Try to force a component re-render
  console.warn('[TEST-6] Attempting to force component update...');
  
  // Try to find and trigger a state update
  try {
    const buttons = document.querySelectorAll('button');
    console.warn('[TEST-6] Found buttons:', buttons.length);
    
    // Look for save or toggle buttons
    const saveButtons = Array.from(buttons).filter(btn => 
      btn.textContent.toLowerCase().includes('save') || 
      btn.textContent.toLowerCase().includes('сохранить')
    );
    console.warn('[TEST-6] Found save buttons:', saveButtons.length);
    
    const toggleButtons = Array.from(buttons).filter(btn => 
      btn.getAttribute('role') === 'switch' ||
      btn.classList.contains('switch') ||
      btn.type === 'checkbox'
    );
    console.warn('[TEST-6] Found toggle buttons:', toggleButtons.length);
  } catch (e) {
    console.error('[TEST-6] Error finding buttons:', e);
  }
  
  console.warn('=== EMERGENCY CONSOLE TEST COMPLETED ===');
  
  // Set up a periodic check to see if TTS component loads
  console.warn('Setting up periodic check for TTS component...');
  let checkCount = 0;
  const interval = setInterval(() => {
    checkCount++;
    console.warn(`[PERIODIC-CHECK-${checkCount}] Checking for TTS component...`);
    
    // Look for TTS-specific elements
    const ttsContainers = document.querySelectorAll('[class*="tts-config"], [id*="tts-config"]');
    if (ttsContainers.length > 0) {
      console.warn(`[PERIODIC-CHECK-${checkCount}] FOUND TTS CONTAINER!`, ttsContainers);
      clearInterval(interval);
    }
    
    if (checkCount > 10) {
      console.warn('[PERIODIC-CHECK] Stopping periodic check after 10 attempts');
      clearInterval(interval);
    }
  }, 2000);
})();