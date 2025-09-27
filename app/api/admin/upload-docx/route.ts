import { NextRequest, NextResponse } from 'next/server'
import { DocxParser } from '../../../../lib/docxParser'
import { loadMarkdownFiles } from '../../../../lib/markdownLoader'
import { embedAndStore } from '../../../../lib/vectorStore'
import { promises as fs } from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const autoProcess = formData.get('autoProcess') === 'true'

    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: 'Brak pliku w zapytaniu.' 
      }, { status: 400 })
    }

    if (!file.name.endsWith('.docx')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Obsługiwane są tylko pliki .docx.' 
      }, { status: 400 })
    }

    // Parse DOCX file
    const parsedDoc = await DocxParser.parseDocx(file)
    
    // Generate markdown files
    const markdownFiles = await DocxParser.saveToContentFolder(parsedDoc.sections)
    
    // Save to content folder
    const contentDir = path.join(process.cwd(), 'content')
    await fs.mkdir(contentDir, { recursive: true })
    
    const savedFiles: string[] = []
    
    for (const [filename, content] of Object.entries(markdownFiles)) {
      const filePath = path.join(contentDir, filename)
      await fs.writeFile(filePath, content, 'utf-8')
      savedFiles.push(filename)
    }

    let ragProcessed = false
    let chunksCount = 0

    // Auto-process to RAG if requested
    if (autoProcess) {
      try {
        // Load the new content
        const chunks = await loadMarkdownFiles(contentDir, 500, 100)
        
        // Add to vector store
        await embedAndStore(chunks)
        
        ragProcessed = true
        chunksCount = chunks.length
      } catch (error) {
        console.error('Error processing to RAG:', error)
        // Don't fail the whole request if RAG processing fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Plik "${file.name}" został pomyślnie przetworzony.`,
      data: {
        originalFile: file.name,
        parsedSections: parsedDoc.sections.length,
        savedFiles,
        topics: parsedDoc.metadata.topics,
        totalWordCount: parsedDoc.metadata.totalWordCount,
        ragProcessed,
        chunksCount
      }
    })

  } catch (error: any) {
    console.error('Error in DOCX upload API:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Wystąpił błąd serwera podczas przetwarzania pliku.' 
    }, { status: 500 })
  }
}
