// scripts/query-classifier.js
require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class QueryClassifier {
  
  async classify(question) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a query classifier for a volleyball analytics system.

Classify queries into 3 types:
1. "rag" - Questions about rules, techniques, expert knowledge, theory
   Examples: "Jakie są przepisy zagrywki?", "Jak prawidłowo blokować?"
   
2. "compute" - Questions about statistics, rankings, player performance data
   Examples: "TOP 10 servers", "Kto ma najwięcej asów?", "Statystyki Leona"
   
3. "hybrid" - Questions combining theory with current stats
   Examples: "Jak Wilfredo Leon serwuje vs przepisy?", "Najlepsi blokerzy i techniki bloku"

Respond with JSON only:
{
  "type": "rag" | "compute" | "hybrid",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`
        },
        {
          role: 'user',
          content: question
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    
    return JSON.parse(completion.choices[0].message.content);
  }
}

// Test
async function test() {
  const classifier = new QueryClassifier();
  
  const queries = [
    "Jakie są przepisy dotyczące zagrywki?",
    "TOP 10 servers this season",
    "Kto ma najlepszy serwis i jakie są kluczowe aspekty zagrywki?",
    "Statystyki Wilfredo Leona",
    "Jak prawidłowo wykonać blok?",
    "Porównaj Leon vs Kurek w ataku",
    "Średnia skuteczność przyjęcia w PlusLidze"
  ];
  
  console.log('🎯 QUERY CLASSIFICATION TEST\n');
  console.log('='.repeat(70));
  
  for (const query of queries) {
    const result = await classifier.classify(query);
    
    console.log(`\n📝 Query: "${query}"`);
    console.log(`   Type: ${result.type.toUpperCase()} (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
    console.log(`   Reasoning: ${result.reasoning}`);
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(70));
}

test().catch(console.error);

module.exports = { QueryClassifier };