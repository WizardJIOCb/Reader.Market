const { getPersonalActivitiesDirect } = require('./directStorage.cjs');

async function testDirectImplementation() {
  try {
    console.log('=== Testing Direct Implementation ===\n');
    
    const userId = '605db90f-4691-4281-991e-b2e248e33915';
    const activities = await getPersonalActivitiesDirect(userId, 50, 0);
    
    console.log(`Found ${activities.length} activities:`);
    
    const typeCounts = {};
    activities.forEach(activity => {
      const type = activity.type;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    console.log('\nRecent activities:');
    activities.slice(0, 5).forEach((activity, index) => {
      console.log(`${index + 1}. ${activity.type} - ${activity.metadata.author_name}: "${activity.metadata.content_preview}"`);
      if (activity.type === 'subscribed_comment') {
        console.log(`   ✅ SUBSCRIBED - From book: ${activity.metadata.book_title}`);
      }
      console.log('');
    });
    
    const subscribedActivities = activities.filter(a => a.type === 'subscribed_comment');
    console.log(`\n✅ Found ${subscribedActivities.length} subscribed comment activities`);
    
    if (subscribedActivities.length > 0) {
      console.log('🎉 SUCCESS: Direct implementation works correctly!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDirectImplementation();