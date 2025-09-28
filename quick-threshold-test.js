/**
 * Quick test with lowered threshold (0.3)
 */

require('dotenv').config({ path: '.env.local' });

const API_BASE_URL = 'http://localhost:3000';

const testQuestions = [
  "Jak prawidłowo wykonać blok?",
  "Jakie są rodzaje zagrywek?", 
  "Jak poprawnie wykonać atak?",
  "Ile punktów potrzeba do wygrania seta?",
  "Co to jest libero w siatkówce?"
];

async function quickTest() {
  console.log('🧪 Quick test with threshold 0.3');
  console.log('='.repeat(40));
  
  let databaseResponses = 0;
  let hybridResponses = 0;
  let openaiResponses = 0;
  
  for (const question of testQuestions) {
    try {
      console.log(`\n❓ ${question}`);
      
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, limit: 3 }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        const source = data.context?.responseSource || 'unknown';
        const similarity = data.context?.sources?.[0]?.similarity || 0;
        
        console.log(`   ✅ ${source.toUpperCase()} (${(similarity * 100).toFixed(1)}%)`);
        
        if (source === 'database') databaseResponses++;
        else if (source === 'hybrid') hybridResponses++;
        else openaiResponses++;
      } else {
        console.log(`   ❌ Error: ${data.error}`);
        openaiResponses++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`   ❌ Network error: ${error.message}`);
      openaiResponses++;
    }
  }
  
  console.log('\n📊 RESULTS:');
  console.log(`Database: ${databaseResponses}/${testQuestions.length}`);
  console.log(`Hybrid: ${hybridResponses}/${testQuestions.length}`);
  console.log(`OpenAI: ${openaiResponses}/${testQuestions.length}`);
  console.log(`Success rate: ${((databaseResponses + hybridResponses) / testQuestions.length * 100).toFixed(1)}%`);
}

quickTest().catch(console.error);
