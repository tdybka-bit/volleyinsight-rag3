/**
 * Comprehensive RAG System Test Suite
 * Testuje RAG system z 65 chunkami w bazie danych
 */

require('dotenv').config({ path: '.env.local' });

const API_BASE_URL = 'http://localhost:3000';

// Test questions organized by categories
const testQuestions = {
  przepisy: [
    "Kiedy sędzia pokazuje czerwoną kartkę?",
    "Ile punktów potrzeba do wygrania seta?",
    "Jakie są zasady rotacji zawodników?",
    "Co to jest libero w siatkówce?",
    "Jakie są wymiary boiska do siatkówki?"
  ],
  podstawy: [
    "Jak rozpoczyna się mecz siatkówki?",
    "Ile graczy może być na boisku?",
    "Czym różni się libero od innych graczy?",
    "Jakie są podstawowe pozycje w siatkówce?",
    "Co to jest rotacja w siatkówce?"
  ],
  technika: [
    "Jak prawidłowo wykonać blok?",
    "Jakie są rodzaje zagrywek?",
    "Jak ustawić ręce przy przyjęciu?",
    "Jak poprawnie wykonać atak?",
    "Jakie są podstawy techniki siatkarskiej?"
  ],
  taktyka: [
    "Jakie są podstawowe ustawienia w siatkówce?",
    "Jak rozgrywający powinien rozkładać piłki?",
    "Jakie są strategie blokowania?",
    "Jak organizować obronę w siatkówce?",
    "Jakie są różne systemy gry?"
  ],
  historia: [
    "Kiedy powstała siatkówka?",
    "Kto wynalazł siatkówkę?",
    "Jak ewoluowały przepisy siatkówki?",
    "Jakie były najważniejsze zmiany w siatkówce?",
    "Jak rozwijała się siatkówka na świecie?"
  ]
};

// Test results storage
const testResults = {
  totalQuestions: 0,
  responses: {
    database: 0,
    hybrid: 0,
    openai: 0
  },
  categories: {},
  similarityScores: [],
  responseTimes: [],
  errors: 0,
  details: []
};

async function testRAGSystem() {
  console.log('🧪 ===== COMPREHENSIVE RAG SYSTEM TEST =====');
  console.log('📊 Testing with 65 chunks in database');
  console.log('🎯 Threshold: 0.6\n');

  const startTime = Date.now();

  // Test each category
  for (const [category, questions] of Object.entries(testQuestions)) {
    console.log(`\n📋 Testing ${category.toUpperCase()} questions:`);
    console.log('='.repeat(50));
    
    testResults.categories[category] = {
      total: questions.length,
      database: 0,
      hybrid: 0,
      openai: 0,
      avgSimilarity: 0,
      avgResponseTime: 0
    };

    for (const question of questions) {
      await testQuestion(question, category);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    }
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;

  // Generate comprehensive report
  generateReport(totalTime);
}

async function testQuestion(question, category) {
  const questionStartTime = Date.now();
  
  try {
    console.log(`\n❓ ${question}`);
    
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: question, limit: 3 }),
    });

    const data = await response.json();
    const responseTime = Date.now() - questionStartTime;

    if (data.success) {
      const context = data.context;
      const responseSource = context?.responseSource || 'unknown';
      const similarityScores = context?.sources?.map(s => s.similarity) || [];
      const avgSimilarity = similarityScores.length > 0 
        ? similarityScores.reduce((a, b) => a + b, 0) / similarityScores.length 
        : 0;

      // Update results
      testResults.totalQuestions++;
      testResults.responses[responseSource]++;
      testResults.categories[category][responseSource]++;
      testResults.similarityScores.push(...similarityScores);
      testResults.responseTimes.push(responseTime);
      testResults.categories[category].avgSimilarity += avgSimilarity;
      testResults.categories[category].avgResponseTime += responseTime;

      // Store detailed results
      testResults.details.push({
        question,
        category,
        responseSource,
        similarityScores,
        avgSimilarity,
        responseTime,
        sourcesCount: context?.sourcesCount || 0,
        relevantSourcesCount: context?.relevantSourcesCount || 0,
        sources: context?.sources || []
      });

      console.log(`   ✅ ${responseSource.toUpperCase()} response`);
      console.log(`   📊 Similarity: ${(avgSimilarity * 100).toFixed(1)}%`);
      console.log(`   ⏱️  Time: ${responseTime}ms`);
      console.log(`   📚 Sources: ${context?.sourcesCount || 0} total, ${context?.relevantSourcesCount || 0} relevant`);
      
      if (context?.sources && context.sources.length > 0) {
        console.log(`   📄 Files: ${context.sources.map(s => s.filename).join(', ')}`);
      }
    } else {
      testResults.errors++;
      console.log(`   ❌ Error: ${data.error || 'Unknown error'}`);
    }
  } catch (error) {
    testResults.errors++;
    console.log(`   ❌ Network error: ${error.message}`);
  }
}

function generateReport(totalTime) {
  console.log('\n\n🎉 ===== COMPREHENSIVE TEST REPORT =====');
  console.log(`⏱️  Total test time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`📊 Total questions: ${testResults.totalQuestions}`);
  console.log(`❌ Errors: ${testResults.errors}`);
  
  // Response source breakdown
  console.log('\n📈 RESPONSE SOURCE BREAKDOWN:');
  console.log('='.repeat(40));
  const total = testResults.totalQuestions;
  Object.entries(testResults.responses).forEach(([source, count]) => {
    const percentage = ((count / total) * 100).toFixed(1);
    console.log(`${source.toUpperCase().padEnd(10)}: ${count.toString().padStart(3)} (${percentage}%)`);
  });

  // Category performance
  console.log('\n📋 CATEGORY PERFORMANCE:');
  console.log('='.repeat(60));
  console.log('Category'.padEnd(12) + 'Total'.padEnd(6) + 'DB'.padEnd(4) + 'Hybrid'.padEnd(7) + 'OpenAI'.padEnd(7) + 'Avg Sim'.padEnd(8) + 'Avg Time');
  console.log('-'.repeat(60));
  
  Object.entries(testResults.categories).forEach(([category, stats]) => {
    const dbPct = ((stats.database / stats.total) * 100).toFixed(1);
    const hybridPct = ((stats.hybrid / stats.total) * 100).toFixed(1);
    const openaiPct = ((stats.openai / stats.total) * 100).toFixed(1);
    const avgSim = (stats.avgSimilarity / stats.total * 100).toFixed(1);
    const avgTime = (stats.avgResponseTime / stats.total).toFixed(0);
    
    console.log(
      category.padEnd(12) + 
      stats.total.toString().padEnd(6) + 
      `${stats.database}(${dbPct}%)`.padEnd(4) + 
      `${stats.hybrid}(${hybridPct}%)`.padEnd(7) + 
      `${stats.openai}(${openaiPct}%)`.padEnd(7) + 
      `${avgSim}%`.padEnd(8) + 
      `${avgTime}ms`
    );
  });

  // Similarity analysis
  if (testResults.similarityScores.length > 0) {
    const avgSimilarity = testResults.similarityScores.reduce((a, b) => a + b, 0) / testResults.similarityScores.length;
    const maxSimilarity = Math.max(...testResults.similarityScores);
    const minSimilarity = Math.min(...testResults.similarityScores);
    
    console.log('\n📊 SIMILARITY ANALYSIS:');
    console.log('='.repeat(30));
    console.log(`Average: ${(avgSimilarity * 100).toFixed(1)}%`);
    console.log(`Maximum: ${(maxSimilarity * 100).toFixed(1)}%`);
    console.log(`Minimum: ${(minSimilarity * 100).toFixed(1)}%`);
    
    // Similarity distribution
    const highSim = testResults.similarityScores.filter(s => s >= 0.7).length;
    const medSim = testResults.similarityScores.filter(s => s >= 0.4 && s < 0.7).length;
    const lowSim = testResults.similarityScores.filter(s => s < 0.4).length;
    
    console.log(`\nHigh similarity (≥70%): ${highSim} (${((highSim/testResults.similarityScores.length)*100).toFixed(1)}%)`);
    console.log(`Med similarity (40-70%): ${medSim} (${((medSim/testResults.similarityScores.length)*100).toFixed(1)}%)`);
    console.log(`Low similarity (<40%): ${lowSim} (${((lowSim/testResults.similarityScores.length)*100).toFixed(1)}%)`);
  }

  // Response time analysis
  if (testResults.responseTimes.length > 0) {
    const avgResponseTime = testResults.responseTimes.reduce((a, b) => a + b, 0) / testResults.responseTimes.length;
    const maxResponseTime = Math.max(...testResults.responseTimes);
    const minResponseTime = Math.min(...testResults.responseTimes);
    
    console.log('\n⏱️  RESPONSE TIME ANALYSIS:');
    console.log('='.repeat(30));
    console.log(`Average: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`Maximum: ${maxResponseTime}ms`);
    console.log(`Minimum: ${minResponseTime}ms`);
  }

  // Performance recommendations
  console.log('\n💡 PERFORMANCE RECOMMENDATIONS:');
  console.log('='.repeat(40));
  
  const dbRate = (testResults.responses.database / total * 100);
  const hybridRate = (testResults.responses.hybrid / total * 100);
  const openaiRate = (testResults.responses.openai / total * 100);
  
  if (dbRate < 30) {
    console.log('⚠️  Low database response rate - consider adding more relevant content');
  }
  if (hybridRate < 20) {
    console.log('⚠️  Low hybrid response rate - similarity threshold might be too high');
  }
  if (openaiRate > 50) {
    console.log('⚠️  High OpenAI fallback rate - database content may not match questions');
  }
  
  console.log(`✅ Database success rate: ${dbRate.toFixed(1)}%`);
  console.log(`✅ Hybrid success rate: ${hybridRate.toFixed(1)}%`);
  console.log(`✅ Combined database+hybrid: ${(dbRate + hybridRate).toFixed(1)}%`);

  // Best performing categories
  const bestCategory = Object.entries(testResults.categories)
    .sort((a, b) => (b[1].database + b[1].hybrid) - (a[1].database + a[1].hybrid))[0];
  
  console.log(`\n🏆 Best performing category: ${bestCategory[0]} (${bestCategory[1].database + bestCategory[1].hybrid}/${bestCategory[1].total} database+hybrid responses)`);

  console.log('\n🎯 ===== TEST COMPLETED =====\n');
}

// Run the comprehensive test
testRAGSystem().catch(console.error);

