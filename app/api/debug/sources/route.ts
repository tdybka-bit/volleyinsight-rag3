import { NextResponse } from 'next/server'
import { searchSimilar } from '../../../../lib/vectorStore'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || 'blok'
    const limit = parseInt(searchParams.get('limit') || '5')

    // Testuj wyszukiwanie dla różnych zapytań
    const testQueries = [
      'blok',
      'atak', 
      'zagrywka',
      'obrona',
      'przepisy',
      'ustawienia'
    ]

    const results: any = {}

    for (const testQuery of testQueries) {
      try {
        const searchResults = await searchSimilar(testQuery, limit)
        results[testQuery] = {
          found: searchResults.length,
          sources: searchResults.map(result => ({
            type: result.metadata.type,
            filename: result.metadata.filename,
            chunkIndex: result.metadata.chunkIndex,
            similarity: Math.round(result.similarity * 100),
            contentPreview: result.content.substring(0, 150) + '...'
          })),
          bestMatch: searchResults.length > 0 ? {
            type: searchResults[0].metadata.type,
            filename: searchResults[0].metadata.filename,
            similarity: Math.round(searchResults[0].similarity * 100)
          } : null
        }
      } catch (error) {
        console.error(`Błąd wyszukiwania dla "${testQuery}":`, error)
        results[testQuery] = {
          found: 0,
          error: error instanceof Error ? error.message : 'Nieznany błąd',
          sources: []
        }
      }
    }

    // Testuj konkretne zapytanie jeśli podano
    let specificQueryResults = null
    if (query && query !== 'blok') {
      try {
        const specificResults = await searchSimilar(query, limit)
        specificQueryResults = {
          query,
          found: specificResults.length,
          sources: specificResults.map(result => ({
            type: result.metadata.type,
            filename: result.metadata.filename,
            chunkIndex: result.metadata.chunkIndex,
            similarity: Math.round(result.similarity * 100),
            contentPreview: result.content.substring(0, 150) + '...'
          }))
        }
      } catch (error) {
        console.error(`Błąd wyszukiwania dla "${query}":`, error)
        specificQueryResults = {
          query,
          found: 0,
          error: error instanceof Error ? error.message : 'Nieznany błąd'
        }
      }
    }

    // Analiza mapy źródeł
    const sourceMap: any = {}
    Object.entries(results).forEach(([query, data]: [string, any]) => {
      if (data.sources) {
        data.sources.forEach((source: any) => {
          const key = `${source.filename}-${source.type}`
          if (!sourceMap[key]) {
            sourceMap[key] = {
              filename: source.filename,
              type: source.type,
              queries: [],
              totalSimilarity: 0
            }
          }
          sourceMap[key].queries.push(query)
          sourceMap[key].totalSimilarity += source.similarity
        })
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        testQueries: results,
        specificQuery: specificQueryResults,
        sourceMap: Object.values(sourceMap),
        summary: {
          totalUniqueSources: Object.keys(sourceMap).length,
          mostRelevantSource: Object.values(sourceMap).sort((a: any, b: any) => b.totalSimilarity - a.totalSimilarity)[0],
          queriesWithResults: Object.values(results).filter((data: any) => data.found > 0).length,
          totalTestQueries: testQueries.length
        }
      }
    })

  } catch (error: any) {
    console.error('Błąd debug sources:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Nieznany błąd'
    }, { status: 500 })
  }
}

