/**
 * Quick RAG Test
 * Szybki test RAG z przykładowymi pytaniami
 */

const API_BASE_URL = 'http://localhost:3000';

// Przykładowe pytania do testowania
const testQuestions = [
  {
    question: 'Jak prawidłowo ustawić ręce przy bloku?',
    expected: 'database',
    description: 'HIGH MATCH - powinno być w bazie'
  },
  {
    question: 'Jakie są zasady rotacji w siatkówce?',
    expected: 'database', 
    description: 'HIGH MATCH - powinno być w bazie'
  },
  {
    question: 'Jak trenować blok dla juniorów?',
    expected: 'hybrid',
    description: 'PARTIAL MATCH - częściowe dopasowanie'
  },
  {
    question: 'Psychologia ataku w siatkówce',
    expected: 'hybrid',
    description: 'PARTIAL MATCH - częściowe dopasowanie'
  },
  {
    question: 'Historia powstania siatkówki',
    expected: 'openai',
    description: 'NO MATCH - poza bazą wiedzy'
  },
  {
    question: 'Różnice między siatkówką plażową a halową',
    expected: 'openai',
    description: 'NO MATCH - poza bazą wiedzy'
  }
];

async function testRAG() {
  console.log('🚀 ===== QUICK RAG TEST =====\n');
  
  for (let i = 0; i < testQuestions.length; i++) {
    const test = testQuestions[i];
    console.log(`\n🔍 Test ${i + 1}/${testQuestions.length}`);
    console.log(`📝 Pytanie: "${test.question}"`);
    console.log(`📋 Opis: ${test.description}`);
    console.log(`🎯 Oczekiwany: ${test.expected.toUpperCase()}`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: test.question, limit: 5 })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const actualSource = data.context?.responseSource || 'unknown';
      const isCorrect = actualSource === test.expected;
      
      console.log(`📊 Wynik:`);
      console.log(`  ✅ Rzeczywisty source: ${actualSource.toUpperCase()}`);
      console.log(`  ${isCorrect ? '✅' : '❌'} Test: ${isCorrect ? 'PASSED' : 'FAILED'}`);
      console.log(`  📚 Context: ${data.context?.hasContext ? 'Tak' : 'Nie'}`);
      console.log(`  🔢 Sources: ${data.context?.sourcesCount || 0} total, ${data.context?.relevantSourcesCount || 0} relevant`);
      
      if (data.context?.sources?.length > 0) {
        console.log(`  📈 Similarity scores:`);
        data.context.sources.forEach((source, idx) => {
          console.log(`    ${idx + 1}. ${source.type}: ${(source.similarity * 100).toFixed(1)}% ${source.isRelevant ? '✅' : '❌'}`);
        });
      }
      
      console.log(`  💬 Response: ${data.message?.substring(0, 150)}...`);
      
    } catch (error) {
      console.log(`❌ Błąd: ${error.message}`);
    }
    
    // Pauza między testami
    if (i < testQuestions.length - 1) {
      console.log('\n⏳ Czekam 2 sekundy...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n✅ ===== KONIEC TESTU =====');
}

// Uruchom test
testRAG().catch(console.error);












