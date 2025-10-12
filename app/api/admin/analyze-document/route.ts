import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import mammoth from 'mammoth';

// ✅ Lazy initialization
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

const CATEGORIES = ['blok', 'atak', 'obrona', 'zagrywka', 'ustawienia', 'przepisy', 'ogólne'];

interface AnalysisResult {
  text: string;
  suggestedCategory: string;
  confidence: number;
  index: number;
}

export async function POST(request: NextRequest) {
  try {
    console.log(`🤖 ===== AI DOCUMENT ANALYSIS =====`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const manualCategory = formData.get('manualCategory') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'Brak pliku do analizy' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.docx')) {
      return NextResponse.json(
        { error: 'Plik musi być w formacie .docx' },
        { status: 400 }
      );
    }

    console.log(`📄 Analyzing file: ${file.name} (${file.size} bytes)`);
    if (manualCategory) {
      console.log(`🏷️ Manual category: ${manualCategory}`);
    }

    // 1. Parse document using mammoth
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
    const fullText = result.value;

    if (!fullText.trim()) {
      return NextResponse.json(
        { error: 'Plik jest pusty lub nie można go odczytać' },
        { status: 400 }
      );
    }

    console.log(`📝 Extracted text: ${fullText.length} characters`);

    // 2. Split into paragraphs/sections
    const paragraphs = fullText
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 20) // Filter out very short paragraphs
      .map((text, index) => ({ text, index }));

    console.log(`📋 Split into ${paragraphs.length} paragraphs`);

    if (paragraphs.length === 0) {
      return NextResponse.json(
        { error: 'Nie znaleziono odpowiednich paragrafów do analizy' },
        { status: 400 }
      );
    }

    // 3. Analyze each paragraph with OpenAI
    const analysisResults: AnalysisResult[] = [];
    const startTime = Date.now();
    const timeout = 60000; // 60 seconds timeout

    for (let i = 0; i < paragraphs.length; i++) {
      // Check timeout
      if (Date.now() - startTime > timeout) {
        console.log(`⏰ Timeout reached at paragraph ${i}/${paragraphs.length}`);
        break;
      }

      const { text, index } = paragraphs[i];

        try {
          let category: string;
          let confidence: number;

          // Use manual category if provided
          if (manualCategory && CATEGORIES.includes(manualCategory)) {
            category = manualCategory;
            confidence = 1.0; // High confidence for manual selection
            console.log(`🏷️ Paragraph ${i + 1}: Manual category ${category}`);
          } else {
            // Use AI categorization
            const openai = getOpenAI(); // ✅ Pobierz klienta tutaj
            const completion = await openai.chat.completions.create({
              model: "gpt-3.5-turbo",
              messages: [
                {
                  role: "system",
                  content: `Jesteś ekspertem od siatkówki. Kategoryzuj fragmenty tekstu o siatkówce do JEDNEJ z kategorii: ${CATEGORIES.join(', ')}.

ZASADY:
- Zwróć TYLKO nazwę kategorii i confidence (0-1) w formacie JSON
- Używaj polskich nazw kategorii
- Confidence: 1.0 = bardzo pewny, 0.5 = średnio pewny, 0.1 = niepewny
- Format odpowiedzi: {"category": "nazwa_kategorii", "confidence": 0.8}`

                },
                {
                  role: "user",
                  content: `Fragment tekstu o siatkówce:\n\n${text.substring(0, 1000)}`
                }
              ],
              max_tokens: 100,
              temperature: 0.3,
            });

            const response = completion.choices[0]?.message?.content || '{}';
            
            try {
              const parsed = JSON.parse(response);
              category = parsed.category || 'ogólne';
              confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));
              console.log(`✅ Paragraph ${i + 1}: ${category} (${(confidence * 100).toFixed(1)}%)`);
            } catch (parseError) {
              // Fallback if JSON parsing fails
              category = response.toLowerCase().includes('blok') ? 'blok' :
                        response.toLowerCase().includes('atak') ? 'atak' :
                        response.toLowerCase().includes('obrona') ? 'obrona' :
                        response.toLowerCase().includes('zagrywka') ? 'zagrywka' :
                        response.toLowerCase().includes('ustawienia') ? 'ustawienia' :
                        response.toLowerCase().includes('przepisy') ? 'przepisy' : 'ogólne';
              confidence = 0.3; // Low confidence for fallback
              console.log(`⚠️ Paragraph ${i + 1}: Fallback to ${category}`);
            }
          }

          analysisResults.push({
            text: text,
            suggestedCategory: category,
            confidence: confidence,
            index: index
          });

        // Rate limiting - wait 500ms between requests
        if (i < paragraphs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (openaiError) {
        console.error(`❌ OpenAI error for paragraph ${i + 1}:`, openaiError);
        
        // Fallback categorization based on filename or manual category
        const fallbackCategory = manualCategory || getFallbackCategory(file.name);
        
        analysisResults.push({
          text: text,
          suggestedCategory: fallbackCategory,
          index: index,
          confidence: manualCategory ? 0.8 : 0.2 // Higher confidence for manual, lower for filename fallback
        });
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ Analysis completed: ${analysisResults.length}/${paragraphs.length} paragraphs`);
    console.log(`⏱️ Total time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`===== AI DOCUMENT ANALYSIS COMPLETED =====\n`);

    // Calculate statistics
    const categoryStats = analysisResults.reduce((acc, result) => {
      acc[result.suggestedCategory] = (acc[result.suggestedCategory] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgConfidence = analysisResults.reduce((sum, result) => sum + result.confidence, 0) / analysisResults.length;

    return NextResponse.json({
      success: true,
      filename: file.name,
      totalParagraphs: paragraphs.length,
      analyzedParagraphs: analysisResults.length,
      results: analysisResults,
      statistics: {
        categoryStats,
        averageConfidence: avgConfidence,
        lowConfidenceCount: analysisResults.filter(r => r.confidence < 0.6).length
      },
      processingTime: totalTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in document analysis:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Błąd podczas analizy dokumentu',
      details: error instanceof Error ? error.message : 'Nieznany błąd',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function getFallbackCategory(filename: string): string {
  const lowerName = filename.toLowerCase();
  
  if (lowerName.includes('blok')) return 'blok';
  if (lowerName.includes('atak')) return 'atak';
  if (lowerName.includes('obrona') || lowerName.includes('defense')) return 'obrona';
  if (lowerName.includes('zagrywka') || lowerName.includes('serve')) return 'zagrywka';
  if (lowerName.includes('ustawienia') || lowerName.includes('set')) return 'ustawienia';
  if (lowerName.includes('przepisy') || lowerName.includes('rules')) return 'przepisy';
  
  return 'ogólne';
}
