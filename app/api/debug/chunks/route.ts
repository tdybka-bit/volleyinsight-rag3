import { NextResponse } from 'next/server'
import { getCollectionStats, searchByType } from '../../../../lib/vectorStore'

export async function GET() {
  try {
    // Pobierz statystyki kolekcji
    const stats = await getCollectionStats()
    
    // Pobierz przykłady chunków dla każdego typu
    const typeExamples: any = {}
    
    for (const type of Object.keys(stats.typeDistribution)) {
      try {
        const examples = await searchByType(type, 3)
        typeExamples[type] = examples.map(example => ({
          content: example.content.substring(0, 200) + '...',
          metadata: example.metadata,
          filename: example.metadata.filename,
          chunkIndex: example.metadata.chunkIndex
        }))
      } catch (error) {
        console.error(`Błąd pobierania przykładów dla typu ${type}:`, error)
        typeExamples[type] = []
      }
    }

    // Analiza dystrybucji chunków
    const totalChunks = stats.totalChunks
    const typeDistribution = Object.entries(stats.typeDistribution).map(([type, count]) => ({
      type,
      count: count as number,
      percentage: totalChunks > 0 ? Math.round(((count as number) / totalChunks) * 100) : 0
    })).sort((a, b) => b.count - a.count)

    return NextResponse.json({
      success: true,
      data: {
        collectionName: stats.collectionName,
        totalChunks,
        typeDistribution,
        typeExamples,
        summary: {
          mostCommonType: typeDistribution[0]?.type || 'brak',
          leastCommonType: typeDistribution[typeDistribution.length - 1]?.type || 'brak',
          typesCount: typeDistribution.length,
          averageChunksPerType: totalChunks > 0 ? Math.round(totalChunks / typeDistribution.length) : 0
        }
      }
    })

  } catch (error: any) {
    console.error('Błąd debug chunks:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Nieznany błąd'
    }, { status: 500 })
  }
}








