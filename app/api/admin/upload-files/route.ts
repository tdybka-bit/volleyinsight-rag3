import { NextRequest, NextResponse } from 'next/server'
import { FileParser } from '../../../../lib/fileParser'
import { loadMarkdownFiles } from '../../../../lib/markdownLoader'
import { embedAndStore } from '../../../../lib/vectorStore'
import { promises as fs } from 'fs'
import * as path from 'path'

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

    // Check if file type is supported
    const supportedExtensions = ['.docx', '.txt', '.pdf']
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    
    if (!fileExtension || !supportedExtensions.includes(`.${fileExtension}`)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Obsługiwane są tylko pliki .docx, .txt i .pdf.' 
      }, { status: 400 })
    }

    // Parse file using the universal parser
    const parsedDoc = await FileParser.parseFile(file)
    
    // Generate markdown files
    const markdownFiles = await FileParser.saveToContentFolder(parsedDoc.sections)
    
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
        fileType: parsedDoc.metadata.fileType,
        parsedSections: parsedDoc.sections.length,
        savedFiles,
        topics: parsedDoc.metadata.topics,
        totalWordCount: parsedDoc.metadata.totalWordCount,
        ragProcessed,
        chunksCount
      }
    })

  } catch (error: any) {
    console.error('Error in file upload API:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Wystąpił błąd serwera podczas przetwarzania pliku.' 
    }, { status: 500 })
  }
}
