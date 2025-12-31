import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const index = pinecone.index('ed-volley');

// Multi-language system prompts
const getLanguagePrompt = (lang: string) => {
  const prompts: Record<string, string> = {
    pl: 'Jesteś doświadczonym komentarorem meczów siatkarskich w Polsce. Komentuj po POLSKU.',
    en: 'You are an experienced volleyball commentator. Comment in ENGLISH.',
    it: 'Sei un commentatore esperto di pallavolo. Commenta in ITALIANO.',
    de: 'Du bist ein erfahrener Volleyball-Kommentator. Kommentiere auf DEUTSCH.',
    fr: 'Vous êtes un commentateur de volleyball expérimenté. Commentez en FRANÇAIS.',
    es: 'Eres un comentarista experimentado de voleibol. Comenta en ESPAÑOL.',
    pt: 'Você é um comentarista experiente de vôlei. Comente em PORTUGUÊS.',
    jp: 'あなたは経験豊富なバレーボールの実況者です。日本語でコメントしてください。',
  };
  return prompts[lang] || prompts.pl;
};

// System prompt dla komentarza meczowego - dynamiczny w zależności od sytuacji
const getCommentarySystemPrompt = (isHotSituation: boolean, isEarlySet: boolean, language: string = 'pl') => {
  const langPrompt = getLanguagePrompt(language);
  
  const basePrompt = `${langPrompt}
Your task is to generate professional, insightful match commentary.

STYLE:
- Professional, factual language
- Reference player characteristics (height, playing style, strengths)
- Short, concise comments (1-2 sentences max)
- Use volleyball terminology`;

  if (isHotSituation) {
    return basePrompt + `
- HOT SITUATION! Every point crucial - add emotion and tension!

EXAMPLES (Polish):
- "W kluczowym momencie Grozdanov pokazuje klasę! Blok który może zadecydować o secie!"
- "McCarthy as serwisowy w najważniejszym momencie! Nerwy ze stali!"`;
  } else if (isEarlySet) {
    return basePrompt + `
- Early set, players warming up - calm, analytical commentary

EXAMPLES (Polish):
- "Grozdanov rozpoczyna od solidnego bloku. Dobry początek dla środkowego."
- "McCarthy pewny serwis na start. Zawiercie testuje przyjęcie rywali."`;
  } else {
    return basePrompt + `
- Mid-set - factual, no exaggeration

EXAMPLES (Polish):
- "Grozdanov skuteczny w bloku. Wykorzystał przewagę wzrostu."
- "McCarthy pewny w zagrywce. Stabilny element drużyny."`;
  }
};

interface RallyData {
  rally_number: number;
  score_before: { aluron: number; bogdanka: number };
  score_after: { aluron: number; bogdanka: number };
  team_scored: string;
  touches: Array<{
    action: string;
    player: string;
    number: string;
    team: string;
  }>;
  final_action: {
    type: string;
    player: string;
    number: string;
  };
}

interface CommentaryRequest {
  rally: RallyData;
  language?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { rally, language = 'pl' }: CommentaryRequest = await request.json();

    if (!rally) {
      return new Response('Rally data is required', { status: 400 });
    }

    // Extract final action info
    const finalTouch = rally.touches[rally.touches.length - 1];
    let scoringPlayer = finalTouch.player;
    let scoringAction = finalTouch.action;
    let playerTeam = finalTouch.team; // 'aluron' or 'bogdanka' from JSON
    
    // Map team codes to full names
    const teamNames: Record<string, string> = {
      'aluron': 'Aluron CMC Warta Zawiercie',
      'bogdanka': 'BOGDANKA LUK Lublin'
    };
    
    const playerTeamName = teamNames[playerTeam] || rally.team_scored;

    // Determine if hot situation (score >= 20:20)
    const isHotSituation = rally.score_after.aluron >= 20 && rally.score_after.bogdanka >= 20;
    const isEarlySet = rally.rally_number <= 10;

    console.log('🎯 Commentary request:', {
      rally_number: rally.rally_number,
      player: scoringPlayer,
      action: scoringAction,
      player_team_code: playerTeam,
      player_team_name: playerTeamName,
      team_scored: rally.team_scored,
      is_hot: isHotSituation,
      is_early: isEarlySet,
    });

    // KROK 1: Query RAG dla zawodnika
    const searchQuery = `${scoringPlayer} ${scoringAction} characteristics playing style`;
    console.log('🔍 RAG query:', searchQuery);

    // Generate embedding for search
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: searchQuery,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search Pinecone
    const searchResults = await index.namespace('default').query({
      vector: queryEmbedding,
      topK: 3,
      includeMetadata: true,
    });

    console.log('📊 RAG results:', searchResults.matches.length, 'matches');

    // KROK 2: Extract context from RAG
    let playerContext = '';
    if (searchResults.matches.length > 0) {
      playerContext = searchResults.matches
        .map((match) => match.metadata?.text || '')
        .join('\n\n');
      console.log('✅ Player context found:', playerContext.substring(0, 200) + '...');
    } else {
      console.log('⚠️ No RAG context found for player');
    }

    // KROK 3: Generate commentary prompt
    const score = `${rally.score_after.aluron}:${rally.score_after.bogdanka}`;
    
    const commentaryPrompt = `
AKCJA MECZOWA:
Rally #${rally.rally_number}
Zawodnik: ${scoringPlayer}
Drużyna zawodnika: ${playerTeamName}
Akcja: ${scoringAction}
Wynik po akcji: ${score}
Punkt zdobyła: ${rally.team_scored}

${playerContext ? `CHARAKTERYSTYKA ZAWODNIKA:\n${playerContext}` : ''}

Wygeneruj ${isHotSituation ? 'emocjonalny, pełen napięcia' : isEarlySet ? 'spokojny, analityczny' : 'rzeczowy, profesjonalny'} komentarz do tej akcji (1-2 zdania max).
${playerContext ? 'Użyj informacji o charakterystyce zawodnika jeśli są dostępne.' : ''}
WAŻNE: Zawodnik ${scoringPlayer} gra dla drużyny ${playerTeamName}!
`;

    console.log('🎤 Generating commentary...');

    // KROK 4: Stream commentary from GPT-4o-mini with dynamic system prompt
    const systemPrompt = getCommentarySystemPrompt(isHotSituation, isEarlySet, language);
    
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: commentaryPrompt },
      ],
      temperature: isHotSituation ? 0.9 : 0.7, // Higher temp for hot situations
      max_tokens: 150,
      stream: true,
    });

    // Create streaming response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          console.error('❌ Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('❌ Commentary API error:', error);
    return new Response('Error generating commentary', { status: 500 });
  }
}