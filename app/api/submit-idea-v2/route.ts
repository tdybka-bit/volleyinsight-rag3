import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { Redis } from '@upstash/redis';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const index = pinecone.index('ed-volley');

const redis = Redis.fromEnv();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface IdeaSubmission {
  idea: string;
  type: 'commentary' | 'feature';
  priority: 'high' | 'medium' | 'low';
}

interface ProcessedHint {
  hint: string;
  category: 'commentary' | 'feature';
  confidence: number;
}

/**
 * 🤖 Process user's descriptive feedback into a concise RAG hint using Gemini
 */
async function processWithGemini(userInput: string): Promise<ProcessedHint> {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.3, // Lower = more consistent
        maxOutputTokens: 200,
      }
    });

    const prompt = `Przekształć poniższą sugestię użytkownika na KRÓTKI hint dla systemu RAG generującego komentarze do meczów siatkówki.

SUGESTIA UŻYTKOWNIKA:
"${userInput}"

ZASADY:
1. Hint MAX 1-2 zdania (usuń przykłady i długie opisy)
2. Jeśli dotyczy nazwy/imienia → "ZAWSZE używaj: [poprawna nazwa] (nie [błędna nazwa]). [Powód jeśli istotny]"
3. Jeśli dotyczy kontekstu/stylu → "WAŻNE: [konkretna informacja]"
4. Jeśli dotyczy błędu technicznego → "[Typ akcji]: [poprawka]"
5. Określ kategorię:
   - "commentary" = poprawa/korekta komentarza (nazwy, fakty, styl)
   - "feature" = nowa funkcja, zmiana UI, nowe dane

ODPOWIEDŹ (TYLKO JSON, bez \`\`\`):
{
  "hint": "Twój skrócony hint tutaj",
  "category": "commentary",
  "confidence": 0.95
}

confidence: 0-1 jak bardzo jesteś pewien kategorii (0.8+ = pewny, <0.8 = niepewny)`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    console.log('🤖 Gemini raw response:', responseText);

    // Clean up response (remove markdown code blocks if present)
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed: ProcessedHint = JSON.parse(cleanedText);

    console.log('✅ Gemini processed hint:', parsed);

    return parsed;
  } catch (error) {
    console.error('❌ Gemini processing failed:', error);
    // Fallback: return original input
    return {
      hint: userInput,
      category: 'feature', // Safe default - manual review
      confidence: 0.5,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { idea, type, priority }: IdeaSubmission = await request.json();

    if (!idea || !idea.trim()) {
      return new Response(JSON.stringify({ error: 'Idea is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`📥 New submission:`, idea.substring(0, 100));

    // ========================================================================
    // 🤖 PROCESS WITH GEMINI AI
    // ========================================================================
    const processed = await processWithGemini(idea);
    
    // Use AI category if user didn't specify OR if AI is very confident
    const finalType = type || (processed.confidence >= 0.8 ? processed.category : 'feature');
    const finalHint = processed.hint;

    console.log(`🎯 Final type: ${finalType} (AI: ${processed.category}, confidence: ${processed.confidence})`);
    console.log(`💡 Final hint: ${finalHint}`);

    // ========================================================================
    // COMMENTARY → Pinecone (RAG learns)
    // ========================================================================
    if (finalType === 'commentary') {
      try {
        // Generate embedding for the PROCESSED hint (not original)
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: finalHint,
          dimensions: 768,
        });

        // Generate unique ID
        const id = `commentary-hint-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Save to Pinecone
        await index.namespace('commentary-hints').upsert([
          {
            id,
            values: embedding.data[0].embedding,
            metadata: {
              text: finalHint, // Processed hint
              betterCommentary: finalHint, // This is what RAG reads
              originalInput: idea, // Keep original for reference
              category: 'user-submitted',
              priority: priority,
              source: 'idea-submit',
              aiProcessed: true,
              aiConfidence: processed.confidence,
              addedAt: new Date().toISOString(),
            },
          },
        ]);

        console.log(`✅ Commentary hint added to Pinecone: ${id}`);

        return new Response(JSON.stringify({
          success: true,
          type: 'commentary',
          id,
          message: 'RAG learned! ✅ Hint added to Pinecone',
          processedHint: finalHint,
          originalInput: idea,
          aiConfidence: processed.confidence,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('❌ Failed to add commentary hint:', error);
        return new Response(JSON.stringify({
          error: 'Failed to save commentary hint',
          details: String(error),
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // ========================================================================
    // FEATURE → Redis (VoC for manual review)
    // ========================================================================
    if (finalType === 'feature') {
      try {
        const ideaId = `idea-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const ideaData = {
          id: ideaId,
          idea: idea,
          processedHint: finalHint,
          type: 'feature',
          priority: priority,
          status: 'new',
          aiProcessed: true,
          aiConfidence: processed.confidence,
          aiSuggestedCategory: processed.category,
          createdAt: new Date().toISOString(),
          page: '/idea-submit',
        };

        // Save to Redis
        await redis.set(`idea:${ideaId}`, JSON.stringify(ideaData));
        
        // Add to ideas list
        await redis.lpush('ideas:all', ideaId);

        console.log(`✅ Feature idea saved to Redis: ${ideaId}`);

        return new Response(JSON.stringify({
          success: true,
          type: 'feature',
          id: ideaId,
          message: 'Saved for manual review 📝',
          processedHint: finalHint,
          aiConfidence: processed.confidence,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('❌ Failed to save feature idea:', error);
        return new Response(JSON.stringify({
          error: 'Failed to save feature idea',
          details: String(error),
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Should never reach here
    return new Response(JSON.stringify({ error: 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Submit idea API error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process idea',
      details: String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}