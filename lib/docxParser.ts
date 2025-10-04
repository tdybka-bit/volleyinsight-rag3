import mammoth from 'mammoth'

export interface ParsedSection {
  title: string
  content: string
  level: number
  topic?: string
  difficulty?: 'podstawowy' | 'średni' | 'zaawansowany'
  keywords: string[]
  metadata: {
    originalFile: string
    sectionIndex: number
    wordCount: number
    createdAt: string
  }
}

export interface ParsedDocument {
  sections: ParsedSection[]
  metadata: {
    originalFile: string
    totalSections: number
    totalWordCount: number
    topics: string[]
    parsedAt: string
  }
}

// Keywords mapping for topic detection
const TOPIC_KEYWORDS = {
  'blok': ['blok', 'blokowanie', 'blokada', 'blokować', 'blokuj', 'blokowanie piłki', 'technika bloku', 'blok pojedynczy', 'blok podwójny', 'blok potrójny'],
  'atak': ['atak', 'atakować', 'atakowanie', 'uderzenie', 'uderzać', 'spike', 'atak z prawej', 'atak z lewej', 'atak środkowy', 'atak z tyłu'],
  'obrona': ['obrona', 'bronić', 'bronienie', 'obronić', 'obronny', 'obrona pola', 'obrona siatki', 'obrona zagrywki'],
  'zagrywka': ['zagrywka', 'zagrywać', 'serw', 'serwować', 'zagrywka z góry', 'zagrywka z dołu', 'zagrywka wyskokowa', 'zagrywka z wiatrem'],
  'ustawienia': ['ustawienia', 'ustawianie', 'ustawić', 'ustawka', 'pasy', 'pasy do ataku', 'pasy do bloku', 'pasy do obrony', 'pasy do zagrywki'],
  'przepisy': ['przepisy', 'regulamin', 'zasady', 'reguły', 'sędziowanie', 'sędzia', 'punkt', 'set', 'mecz', 'faule', 'błędy']
}

// Difficulty detection keywords
const DIFFICULTY_KEYWORDS = {
  'podstawowy': ['podstawy', 'podstawowy', 'początkujący', 'nauka', 'wprowadzenie', 'abc', 'elementarny'],
  'średni': ['średni', 'poziom średni', 'intermediate', 'średniozaawansowany', 'rozwinięty'],
  'zaawansowany': ['zaawansowany', 'ekspert', 'profesjonalny', 'wysoki poziom', 'master', 'zaawansowane techniki']
}

export class DocxParser {
  private static detectCategoryFromFilename(filename: string): string | undefined {
    const lowerFilename = filename.toLowerCase()
    
    // Map filename patterns to categories
    const categoryPatterns = {
      'przepisy': ['przepis', 'przepisy', 'regulamin', 'zasady', 'reguły'],
      'blok': ['blok', 'blokowanie', 'blokada'],
      'atak': ['atak', 'uderzenie', 'spike'],
      'obrona': ['obrona', 'bronienie'],
      'zagrywka': ['zagrywka', 'serw', 'serwowanie'],
      'ustawienia': ['ustawienia', 'ustawka', 'pasy'],
      'trening': ['trening', 'ćwiczenia', 'drill'],
      'technika': ['technika', 'techniki'],
      'taktyka': ['taktyka', 'taktyki', 'strategia']
    }
    
    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      if (patterns.some(pattern => lowerFilename.includes(pattern))) {
        console.log(`File: ${filename} → detected category from filename: ${category}`)
        return category
      }
    }
    
    return undefined
  }

  private static detectCategoryFromMetadata(content: string): string | undefined {
    const lines = content.split('\n').map(line => line.trim())
    
    // Check first few lines for "KATEGORIA: [nazwa]" pattern
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i]
      const categoryMatch = line.match(/KATEGORIA:\s*([a-zA-Ząćęłńóśźż\s]+)/i)
      if (categoryMatch) {
        const category = categoryMatch[1].toLowerCase().trim()
        console.log(`File: detected category from metadata: ${category}`)
        return category
      }
    }
    
    return undefined
  }

  private static detectTopic(text: string): string | undefined {
    const lowerText = text.toLowerCase()
    
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return topic
      }
    }
    
    return undefined
  }

  private static detectDifficulty(text: string): 'podstawowy' | 'średni' | 'zaawansowany' {
    const lowerText = text.toLowerCase()
    
    for (const [difficulty, keywords] of Object.entries(DIFFICULTY_KEYWORDS)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return difficulty as 'podstawowy' | 'średni' | 'zaawansowany'
      }
    }
    
    return 'podstawowy' // Default
  }

  private static extractKeywords(text: string): string[] {
    const keywords = new Set<string>()
    const lowerText = text.toLowerCase()
    
    // Extract all topic keywords
    Object.values(TOPIC_KEYWORDS).flat().forEach(keyword => {
      if (lowerText.includes(keyword)) {
        keywords.add(keyword)
      }
    })
    
    // Extract common volleyball terms
    const volleyballTerms = [
      'siatkówka', 'piłka', 'siatka', 'boisko', 'drużyna', 'zawodnik', 'trener',
      'technika', 'taktyka', 'strategia', 'ćwiczenie', 'trening', 'mecz', 'turniej',
      'mistrzostwa', 'liga', 'klub', 'reprezentacja', 'olimpiada', 'mistrzostwa świata'
    ]
    
    volleyballTerms.forEach(term => {
      if (lowerText.includes(term)) {
        keywords.add(term)
      }
    })
    
    return Array.from(keywords).slice(0, 10) // Limit to 10 keywords
  }

  private static cleanContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n\n') // Replace multiple newlines with double newline
      .trim()
  }

  private static extractSectionsFromHtml(html: string, originalFile: string): ParsedSection[] {
    const sections: ParsedSection[] = []
    
    // Detect category from filename first
    const filenameCategory = this.detectCategoryFromFilename(originalFile)
    
    // Detect category from metadata in content
    const metadataCategory = this.detectCategoryFromMetadata(html.replace(/<[^>]*>/g, ''))
    
    // Use filename category as primary, metadata as fallback
    const detectedCategory = filenameCategory || metadataCategory || 'uncategorized'
    
    console.log(`File: ${originalFile} → detected category: ${detectedCategory}`)
    
    // First try to split by headers (h1, h2, h3) - standard format
    const headerRegex = /<(h[1-3])[^>]*>(.*?)<\/h[1-3]>/gi
    const headerParts = html.split(headerRegex)
    
    if (headerParts.length > 1) {
      // Standard HTML with headers
      let currentSection: Partial<ParsedSection> | null = null
      let sectionIndex = 0
      
      for (let i = 0; i < headerParts.length; i += 3) {
        const tag = headerParts[i]
        const title = headerParts[i + 1]
        const content = headerParts[i + 2]
        
        if (tag && title) {
          // Save previous section
          if (currentSection && currentSection.content) {
            sections.push(currentSection as ParsedSection)
          }
          
          // Start new section
          const cleanTitle = title.replace(/<[^>]*>/g, '').trim()
          const level = parseInt(tag.charAt(1))
          
          currentSection = {
            title: cleanTitle,
            content: '',
            level,
            topic: detectedCategory,
            difficulty: this.detectDifficulty(cleanTitle),
            keywords: this.extractKeywords(cleanTitle),
            metadata: {
              originalFile,
              sectionIndex: sectionIndex++,
              wordCount: 0,
              createdAt: new Date().toISOString()
            }
          }
        } else if (currentSection && content) {
          // Add content to current section
          const cleanContent = this.cleanContent(content.replace(/<[^>]*>/g, ''))
          currentSection.content += (currentSection.content ? '\n\n' : '') + cleanContent
        }
      }
      
      // Add last section
      if (currentSection && currentSection.content) {
        sections.push(currentSection as ParsedSection)
      }
    } else {
      // Fallback: Split by paragraphs and detect titles
      const paragraphs = html.split(/<p[^>]*>/gi)
      
      let currentSection: Partial<ParsedSection> | null = null
      let sectionIndex = 0
      
      for (const paragraph of paragraphs) {
        const cleanText = paragraph.replace(/<[^>]*>/g, '').replace(/<br\s*\/?>/gi, '\n').trim()
        
        if (!cleanText) continue
        
        // Check if this paragraph contains a title
        const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line.length > 0)
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const isTitle = (
            /^\d+\s+[A-ZĄĆĘŁŃÓŚŹŻ]/.test(line) && line.length < 100
          ) || (
            /^#{1,3}\s+/.test(line) && line.length < 100
          )
          
          if (isTitle) {
            // Save previous section
            if (currentSection && currentSection.content) {
              sections.push(currentSection as ParsedSection)
            }
            
            // Start new section
            currentSection = {
              title: line,
              content: '',
              level: 1,
              topic: detectedCategory,
              difficulty: this.detectDifficulty(line),
              keywords: this.extractKeywords(line),
              metadata: {
                originalFile,
                sectionIndex: sectionIndex++,
                wordCount: 0,
                createdAt: new Date().toISOString()
              }
            }
          } else if (currentSection) {
            // Add content to current section
            const cleanContent = this.cleanContent(line)
            currentSection.content += (currentSection.content ? '\n\n' : '') + cleanContent
          }
        }
      }
      
      // Add last section
      if (currentSection && currentSection.content) {
        sections.push(currentSection as ParsedSection)
      }
    }
    
    // Update word counts
    sections.forEach(section => {
      section.metadata.wordCount = section.content.split(/\s+/).length
    })
    
    return sections
  }
  
  private static looksLikeTitle(text: string): boolean {
    // Check if text looks like a title
    const trimmed = text.trim()
    
    // Too long to be a title
    if (trimmed.length > 100) return false
    
    // Check for common title patterns
    const titlePatterns = [
      /^\d+\s+[A-ZĄĆĘŁŃÓŚŹŻ]/, // Numbered titles like "7 Historia siatkówki"
      /^#{1,3}\s+/, // Markdown headers like "### Historia siatkówki"
      /^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+\s+[a-ząćęłńóśźż]/, // Title case
      /^(Wprowadzenie|Historia|Podstawy|Technika|Taktyka|Ćwiczenia|Zakończenie)/i
    ]
    
    return titlePatterns.some(pattern => pattern.test(trimmed))
  }

  static async parseDocx(file: File): Promise<ParsedDocument> {
    try {
      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()
      
      // Convert ArrayBuffer to Buffer for mammoth
      const buffer = Buffer.from(arrayBuffer)
      
      const result = await mammoth.convertToHtml({ buffer })
      
      const sections = this.extractSectionsFromHtml(result.value, file.name)
      
      // Group sections by topic
      const topicGroups = new Map<string, ParsedSection[]>()
      sections.forEach(section => {
        const topic = section.topic || 'uncategorized'
        if (!topicGroups.has(topic)) {
          topicGroups.set(topic, [])
        }
        topicGroups.get(topic)!.push(section)
      })
      
      // Merge sections by topic
      const mergedSections: ParsedSection[] = []
      topicGroups.forEach((topicSections, topic) => {
        if (topicSections.length === 1) {
          mergedSections.push(topicSections[0])
        } else {
          // Merge multiple sections of the same topic
          const mergedSection: ParsedSection = {
            title: `${topic.charAt(0).toUpperCase() + topic.slice(1)} - ${topicSections[0].title}`,
            content: topicSections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n'),
            level: 1,
            topic,
            difficulty: topicSections[0].difficulty,
            keywords: [...new Set(topicSections.flatMap(s => s.keywords))],
            metadata: {
              originalFile: file.name,
              sectionIndex: mergedSections.length,
              wordCount: topicSections.reduce((sum, s) => sum + s.metadata.wordCount, 0),
              createdAt: new Date().toISOString()
            }
          }
          mergedSections.push(mergedSection)
        }
      })
      
      const totalWordCount = mergedSections.reduce((sum, section) => sum + section.metadata.wordCount, 0)
      const topics = Array.from(new Set(mergedSections.map(s => s.topic).filter(Boolean)))
      
      return {
        sections: mergedSections,
        metadata: {
          originalFile: file.name,
          totalSections: mergedSections.length,
          totalWordCount,
          topics,
          parsedAt: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('Error parsing DOCX file:', error)
      throw new Error(`Błąd parsowania pliku DOCX: ${error instanceof Error ? error.message : 'Nieznany błąd'}`)
    }
  }

  static generateMarkdown(section: ParsedSection): string {
    const { title, content, topic, difficulty, keywords, metadata } = section
    
    let markdown = `# ${title}\n\n`
    
    // Add metadata
    markdown += `<!--\n`
    markdown += `Temat: ${topic || 'uncategorized'}\n`
    markdown += `Poziom: ${difficulty}\n`
    markdown += `Słowa kluczowe: ${keywords.join(', ')}\n`
    markdown += `Źródło: ${metadata.originalFile}\n`
    markdown += `Utworzono: ${metadata.createdAt}\n`
    markdown += `Liczba słów: ${metadata.wordCount}\n`
    markdown += `-->\n\n`
    
    // Add content
    markdown += content
    
    return markdown
  }

  static async saveToContentFolder(sections: ParsedSection[]): Promise<{ [topic: string]: string }> {
    const savedFiles: { [topic: string]: string } = {}
    
    for (const section of sections) {
      const topic = section.topic || 'uncategorized'
      const filename = `${topic}.md`
      const markdown = this.generateMarkdown(section)
      
      // In a real implementation, you would save to the file system
      // For now, we'll return the content
      savedFiles[filename] = markdown
    }
    
    return savedFiles
  }
}

