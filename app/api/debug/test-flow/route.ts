import { NextResponse } from 'next/server'
import { loadMarkdownFiles } from '../../../../lib/markdownLoader'
import { embedAndStore, searchSimilar } from '../../../../lib/vectorStore'

export async function POST(request: Request) {
  try {
    const { testType, query } = await request.json()
    
    const results: any = {
      timestamp: new Date().toISOString(),
      testType,
      steps: []
    }

    switch (testType) {
      case 'markdown-load':
        // Test ładowania plików markdown
        results.steps.push({
          step: 'load-markdown',
          description: 'Ładowanie plików markdown z /content/',
          startTime: Date.now()
        })
        
        const chunks = await loadMarkdownFiles('./content', 500, 100)
        
        results.steps.push({
          step: 'load-markdown',
          description: 'Ładowanie plików markdown z /content/',
          status: 'completed',
          endTime: Date.now(),
          data: {
            totalChunks: chunks.length,
            files: [...new Set(chunks.map(c => c.filename))],
            types: [...new Set(chunks.map(c => c.metadata.type))],
            chunksByFile: chunks.reduce((acc, chunk) => {
              if (!acc[chunk.filename]) acc[chunk.filename] = 0
              acc[chunk.filename]++
              return acc
            }, {} as any)
          }
        })
        break

      case 'vector-search':
        // Test wyszukiwania w vector store
        if (!query) {
          return NextResponse.json({
            success: false,
            error: 'Brak zapytania dla testu wyszukiwania'
          }, { status: 400 })
        }

        results.steps.push({
          step: 'vector-search',
          description: `Wyszukiwanie "${query}" w ChromaDB`,
          startTime: Date.now()
        })

        const searchResults = await searchSimilar(query, 5)
        
        results.steps.push({
          step: 'vector-search',
          description: `Wyszukiwanie "${query}" w ChromaDB`,
          status: 'completed',
          endTime: Date.now(),
          data: {
            query,
            resultsFound: searchResults.length,
            results: searchResults.map(result => ({
              type: result.metadata.type,
              filename: result.metadata.filename,
              similarity: Math.round(result.similarity * 100),
              contentPreview: result.content.substring(0, 100) + '...'
            }))
          }
        })
        break

      case 'full-flow':
        // Test pełnego przepływu: markdown → chunks → search → response
        results.steps.push({
          step: 'load-data',
          description: 'Ładowanie danych z plików markdown',
          startTime: Date.now()
        })

        const allChunks = await loadMarkdownFiles('./content', 500, 100)
        
        results.steps.push({
          step: 'load-data',
          description: 'Ładowanie danych z plików markdown',
          status: 'completed',
          endTime: Date.now(),
          data: {
            totalChunks: allChunks.length,
            filesProcessed: [...new Set(allChunks.map(c => c.filename))],
            typesAvailable: [...new Set(allChunks.map(c => c.metadata.type))]
          }
        })

        // Test wyszukiwania dla różnych typów
        const testQueries = ['blok', 'atak', 'przepisy', 'zagrywka']
        
        for (const testQuery of testQueries) {
          results.steps.push({
            step: `search-${testQuery}`,
            description: `Test wyszukiwania: "${testQuery}"`,
            startTime: Date.now()
          })

          try {
            const searchResult = await searchSimilar(testQuery, 3)
            
            results.steps.push({
              step: `search-${testQuery}`,
              description: `Test wyszukiwania: "${testQuery}"`,
              status: 'completed',
              endTime: Date.now(),
              data: {
                query: testQuery,
                resultsFound: searchResult.length,
                bestMatch: searchResult.length > 0 ? {
                  type: searchResult[0].metadata.type,
                  similarity: Math.round(searchResult[0].similarity * 100),
                  filename: searchResult[0].metadata.filename
                } : null
              }
            })
          } catch (error) {
            results.steps.push({
              step: `search-${testQuery}`,
              description: `Test wyszukiwania: "${testQuery}"`,
              status: 'error',
              endTime: Date.now(),
              error: error instanceof Error ? error.message : 'Nieznany błąd'
            })
          }
        }
        break

      case 'embed-test':
        // Test embedowania nowych chunków
        results.steps.push({
          step: 'embed-test',
          description: 'Test embedowania chunków do ChromaDB',
          startTime: Date.now()
        })

        // Stwórz testowe chunki
        const testChunks = [
          {
            content: 'Test bloku: Podstawy techniki bloku w siatkówce. Pozycja wyjściowa, timing, kontakt z piłką.',
            filename: 'test-blok.md',
            chunkIndex: 0,
            metadata: {
              type: 'blok',
              originalFile: 'test-blok'
            }
          },
          {
            content: 'Test ataku: Technika ataku w siatkówce. Rozbieg, skok, uderzenie piłki.',
            filename: 'test-atak.md',
            chunkIndex: 0,
            metadata: {
              type: 'atak',
              originalFile: 'test-atak'
            }
          }
        ]

        try {
          await embedAndStore(testChunks)
          
          results.steps.push({
            step: 'embed-test',
            description: 'Test embedowania chunków do ChromaDB',
            status: 'completed',
            endTime: Date.now(),
            data: {
              chunksEmbedded: testChunks.length,
              types: testChunks.map(c => c.metadata.type)
            }
          })
        } catch (error) {
          results.steps.push({
            step: 'embed-test',
            description: 'Test embedowania chunków do ChromaDB',
            status: 'error',
            endTime: Date.now(),
            error: error instanceof Error ? error.message : 'Nieznany błąd'
          })
        }
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Nieznany typ testu'
        }, { status: 400 })
    }

    // Oblicz czasy wykonania
    results.steps.forEach((step: any, index: number) => {
      if (step.startTime && step.endTime) {
        step.duration = step.endTime - step.startTime
      }
    })

    results.totalDuration = results.steps.reduce((sum: number, step: any) => sum + (step.duration || 0), 0)

    return NextResponse.json({
      success: true,
      data: results
    })

  } catch (error: any) {
    console.error('Błąd test przepływu:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Nieznany błąd'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      availableTests: [
        {
          type: 'markdown-load',
          description: 'Test ładowania plików markdown z /content/',
          method: 'POST'
        },
        {
          type: 'vector-search',
          description: 'Test wyszukiwania w vector store',
          method: 'POST',
          requires: ['query']
        },
        {
          type: 'full-flow',
          description: 'Test pełnego przepływu: markdown → chunks → search',
          method: 'POST'
        },
        {
          type: 'embed-test',
          description: 'Test embedowania chunków do ChromaDB',
          method: 'POST'
        }
      ],
      usage: {
        example: 'POST /api/debug/test-flow with body: { "testType": "markdown-load" }',
        queryExample: 'POST /api/debug/test-flow with body: { "testType": "vector-search", "query": "blok" }'
      }
    }
  })
}








