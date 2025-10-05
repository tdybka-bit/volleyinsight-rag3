import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { loadMarkdownFiles } from '../../../../lib/markdownLoader'

export async function GET() {
  try {
    const contentDir = path.join(process.cwd(), 'content')
    
    // Sprawdź czy folder content istnieje
    let contentExists = false
    let files: string[] = []
    
    try {
      const dirContents = await fs.readdir(contentDir)
      files = dirContents.filter(file => file.endsWith('.md'))
      contentExists = true
    } catch (error) {
      console.log('Folder content nie istnieje')
    }

    // Załaduj i przeanalizuj pliki markdown
    let chunks: any[] = []
    let fileStats: any[] = []
    
    if (contentExists && files.length > 0) {
      chunks = await loadMarkdownFiles(contentDir, 500, 100)
      
      // Statystyki per plik
      for (const file of files) {
        try {
          const filePath = path.join(contentDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const fileChunks = chunks.filter(chunk => chunk.filename === file)
          
          fileStats.push({
            filename: file,
            size: content.length,
            lines: content.split('\n').length,
            chunks: fileChunks.length,
            type: fileChunks[0]?.metadata?.type || 'unknown',
            preview: content.substring(0, 200) + '...'
          })
        } catch (error) {
          console.error(`Błąd analizy pliku ${file}:`, error)
        }
      }
    }

    // Grupuj chunki według typu
    const chunksByType = chunks.reduce((acc, chunk) => {
      const type = chunk.metadata.type
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push({
        chunkIndex: chunk.chunkIndex,
        contentLength: chunk.content.length,
        preview: chunk.content.substring(0, 100) + '...',
        filename: chunk.filename
      })
      return acc
    }, {} as any)

    return NextResponse.json({
      success: true,
      data: {
        contentExists,
        totalFiles: files.length,
        totalChunks: chunks.length,
        files: files,
        fileStats,
        chunksByType,
        summary: {
          typesAvailable: Object.keys(chunksByType),
          averageChunksPerFile: files.length > 0 ? Math.round(chunks.length / files.length) : 0,
          totalContentSize: fileStats.reduce((sum, file) => sum + file.size, 0)
        }
      }
    })

  } catch (error: any) {
    console.error('Błąd debug content:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Nieznany błąd'
    }, { status: 500 })
  }
}




