/**
 * RAG Test Scenarios
 * Testuje różne scenariusze RAG z szczegółowym loggingiem
 */

const API_BASE_URL = 'http://localhost:3000';

// Test scenarios
const testScenarios = [
  {
    category: 'HIGH MATCH (Database Response)',
    description: 'Pytania które powinny mieć wysokie podobieństwo w bazie',
    questions: [
      'Jak prawidłowo ustawić ręce przy bloku?',
      'Jakie są zasady rotacji w siatkówce?',
      'Technika ataku w siatkówce',
      'Podstawy zagrywki',
      'Jak wykonać prawidłowy blok?'
    ],
    expectedSource: 'database'
  },
  {
    category: 'PARTIAL MATCH (Hybrid Response)',
    description: 'Pytania które mogą mieć częściowe dopasowanie',
    questions: [
      'Jak trenować blok dla juniorów?',
      'Psychologia ataku w siatkówce',
      'Ćwiczenia na poprawę techniki ataku',
      'Mentalne przygotowanie do meczu',
      'Jak poprawić skoczność w siatkówce?'
    ],
    expectedSource: 'hybrid'
  },
  {
    category: 'NO MATCH (OpenAI Response)',
    description: 'Pytania poza bazą wiedzy - powinny użyć OpenAI',
    questions: [
      'Historia powstania siatkówki',
      'Różnice między siatkówką plażową a halową',
      'Najlepsi siatkarze świata',
      'Regulamin FIVB',
      'Siatkówka na olimpiadzie'
    ],
    expectedSource: 'openai'
  }
];

/**
 * Wysyła zapytanie do API chat
 */
async function sendChatMessage(message) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        message: message,
        limit: 5 // Zwiększamy limit dla lepszego testowania
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ Błąd wysyłania zapytania: ${error.message}`);
    return null;
  }
}

/**
 * Testuje pojedyncze pytanie
 */
async function testQuestion(question, expectedSource) {
  console.log(`\n🔍 Testowanie: "${question}"`);
  console.log(`🎯 Oczekiwany source: ${expectedSource.toUpperCase()}`);
  
  const result = await sendChatMessage(question);
  
  if (!result) {
    console.log(`❌ Błąd - brak odpowiedzi`);
    return { success: false, actualSource: 'error' };
  }

  const actualSource = result.context?.responseSource || 'unknown';
  const isCorrect = actualSource === expectedSource;
  
  console.log(`📊 Wyniki:`);
  console.log(`  - Response source: ${actualSource.toUpperCase()} ${isCorrect ? '✅' : '❌'}`);
  console.log(`  - Has context: ${result.context?.hasContext ? 'Tak' : 'Nie'}`);
  console.log(`  - Sources count: ${result.context?.sourcesCount || 0}`);
  console.log(`  - Relevant sources: ${result.context?.relevantSourcesCount || 0}`);
  console.log(`  - Similarity threshold: ${result.context?.similarityThreshold || 'N/A'}`);
  
  if (result.context?.sources && result.context.sources.length > 0) {
    console.log(`  - Similarity scores:`);
    result.context.sources.forEach((source, index) => {
      console.log(`    ${index + 1}. ${source.type} - ${(source.similarity * 100).toFixed(1)}% ${source.isRelevant ? '✅' : '❌'}`);
    });
  }
  
  console.log(`  - Response length: ${result.message?.length || 0} znaków`);
  console.log(`  - Response preview: ${result.message?.substring(0, 100)}...`);
  
  return { 
    success: isCorrect, 
    actualSource, 
    expectedSource,
    response: result
  };
}

/**
 * Testuje wszystkie scenariusze
 */
async function runAllTests() {
  console.log('🚀 ===== RAG SCENARIOS TEST =====');
  console.log(`⏰ Start: ${new Date().toLocaleString()}`);
  
  let totalTests = 0;
  let passedTests = 0;
  const results = [];

  for (const scenario of testScenarios) {
    console.log(`\n📋 ===== ${scenario.category} =====`);
    console.log(`📝 ${scenario.description}`);
    
    for (const question of scenario.questions) {
      totalTests++;
      const result = await testQuestion(question, scenario.expectedSource);
      results.push({
        question,
        category: scenario.category,
        expectedSource: scenario.expectedSource,
        actualSource: result.actualSource,
        success: result.success
      });
      
      if (result.success) {
        passedTests++;
      }
      
      // Krótka pauza między pytaniami
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Podsumowanie
  console.log(`\n📊 ===== PODSUMOWANIE TESTÓW =====`);
  console.log(`✅ Przeszło: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  
  // Szczegółowe wyniki
  console.log(`\n📈 Szczegółowe wyniki:`);
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${index + 1}. ${result.question}`);
    console.log(`   Oczekiwany: ${result.expectedSource} | Rzeczywisty: ${result.actualSource}`);
  });

  // Statystyki według kategorii
  console.log(`\n📊 Statystyki według kategorii:`);
  const categoryStats = {};
  results.forEach(result => {
    if (!categoryStats[result.category]) {
      categoryStats[result.category] = { total: 0, passed: 0 };
    }
    categoryStats[result.category].total++;
    if (result.success) {
      categoryStats[result.category].passed++;
    }
  });

  Object.entries(categoryStats).forEach(([category, stats]) => {
    const percentage = ((stats.passed / stats.total) * 100).toFixed(1);
    console.log(`  ${category}: ${stats.passed}/${stats.total} (${percentage}%)`);
  });

  console.log(`\n⏰ Koniec: ${new Date().toLocaleString()}`);
  console.log('===== KONIEC RAG SCENARIOS TEST =====');
}

/**
 * Testuje pojedynczy scenariusz
 */
async function testSingleScenario(scenarioIndex) {
  if (scenarioIndex < 0 || scenarioIndex >= testScenarios.length) {
    console.log('❌ Nieprawidłowy indeks scenariusza');
    return;
  }

  const scenario = testScenarios[scenarioIndex];
  console.log(`🚀 ===== TEST SCENARIUSZA: ${scenario.category} =====`);
  
  for (const question of scenario.questions) {
    await testQuestion(question, scenario.expectedSource);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Uruchomienie testów
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    const scenarioIndex = parseInt(args[0]);
    if (!isNaN(scenarioIndex)) {
      testSingleScenario(scenarioIndex);
    } else {
      console.log('❌ Nieprawidłowy argument. Użyj: node test-rag-scenarios.js [scenario_index]');
    }
  } else {
    runAllTests();
  }
}

module.exports = {
  runAllTests,
  testSingleScenario,
  testQuestion,
  testScenarios
};












