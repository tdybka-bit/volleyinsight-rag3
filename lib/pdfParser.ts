import * as pdf from 'pdf-parse';

export interface PDFParseResult {
  text: string;
  pages: number;
  info?: any;
  metadata?: any;
}

export class PDFParser {
  /**
   * Parse PDF file and extract text content
   * @param buffer - PDF file buffer
   * @returns Promise<PDFParseResult> - Parsed text and metadata
   */
  static async parsePDF(buffer: Buffer): Promise<PDFParseResult> {
    try {
      console.log('📄 Starting PDF parsing...');
      
      const data = await pdf(buffer);
      
      console.log(`✅ PDF parsed successfully: ${data.numpages || 0} pages, ${data.text.length} characters`);
      
      return {
        text: data.text,
        pages: data.numpages || 0,
        info: data.info,
        metadata: data.metadata
      };
    } catch (error) {
      console.error('❌ Error parsing PDF:', error);
      
      // Handle specific PDF parsing errors
      if (error instanceof Error) {
        if (error.message.includes('Invalid PDF')) {
          throw new Error('Plik PDF jest uszkodzony lub nieprawidłowy');
        } else if (error.message.includes('Password')) {
          throw new Error('Plik PDF jest zabezpieczony hasłem - nie można go przetworzyć');
        } else if (error.message.includes('encrypted')) {
          throw new Error('Plik PDF jest zaszyfrowany - nie można go przetworzyć');
        }
      }
      
      throw new Error(`Błąd podczas parsowania pliku PDF: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    }
  }

  /**
   * Validate PDF file before parsing
   * @param buffer - PDF file buffer
   * @returns boolean - True if valid PDF
   */
  static validatePDF(buffer: Buffer): boolean {
    try {
      // Check PDF header
      const header = buffer.toString('ascii', 0, 4);
      if (header !== '%PDF') {
        return false;
      }
      
      // Check minimum file size (PDF files should be at least 1KB)
      if (buffer.length < 1024) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error validating PDF:', error);
      return false;
    }
  }

  /**
   * Extract text from PDF and split into sections
   * @param buffer - PDF file buffer
   * @returns Promise<{sections: string[], metadata: any}>
   */
  static async parsePDFToSections(buffer: Buffer): Promise<{
    sections: string[];
    metadata: {
      totalPages: number;
      totalCharacters: number;
      totalWords: number;
      topics: string[];
    };
  }> {
    try {
      const pdfData = await this.parsePDF(buffer);
      
      // Split text into sections based on common patterns
      const sections = this.splitIntoSections(pdfData.text);
      
      // Extract topics from text
      const topics = this.extractTopics(pdfData.text);
      
      return {
        sections,
        metadata: {
          totalPages: pdfData.pages,
          totalCharacters: pdfData.text.length,
          totalWords: pdfData.text.split(/\s+/).length,
          topics
        }
      };
    } catch (error) {
      console.error('Error parsing PDF to sections:', error);
      throw error;
    }
  }

  /**
   * Split PDF text into logical sections
   * @param text - Full PDF text
   * @returns string[] - Array of text sections
   */
  private static splitIntoSections(text: string): string[] {
    // Common patterns for section breaks in volleyball documents
    const sectionPatterns = [
      /\n\s*\d+\.\s+[A-ZĄĆĘŁŃÓŚŹŻ][^\n]*(?:\n(?!\d+\.\s+[A-ZĄĆĘŁŃÓŚŹŻ])[^\n]*)*/g, // Numbered sections
      /\n\s*[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ\s]+\n(?:\n|.)*?(?=\n\s*[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ\s]+\n|\n\s*\d+\.|\n\s*[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ\s]+\n|$)/g, // Title sections
      /\n\s*[IVX]+\.\s+[A-ZĄĆĘŁŃÓŚŹŻ][^\n]*(?:\n(?!\n\s*[IVX]+\.\s+[A-ZĄĆĘŁŃÓŚŹŻ])[^\n]*)*/g, // Roman numeral sections
    ];

    let sections: string[] = [];
    
    // Try each pattern
    for (const pattern of sectionPatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 1) {
        sections = matches.map(section => section.trim()).filter(section => section.length > 50);
        break;
      }
    }

    // If no patterns matched, split by double newlines or large gaps
    if (sections.length <= 1) {
      sections = text
        .split(/\n\s*\n/)
        .map(section => section.trim())
        .filter(section => section.length > 100);
    }

    // If still no good sections, split by pages (approximate)
    if (sections.length <= 1) {
      const wordsPerPage = Math.ceil(text.split(/\s+/).length / 10); // Assume 10 pages max
      const words = text.split(/\s+/);
      sections = [];
      
      for (let i = 0; i < words.length; i += wordsPerPage) {
        const section = words.slice(i, i + wordsPerPage).join(' ');
        if (section.trim().length > 50) {
          sections.push(section.trim());
        }
      }
    }

    return sections.length > 0 ? sections : [text];
  }

  /**
   * Extract topics from PDF text
   * @param text - Full PDF text
   * @returns string[] - Array of detected topics
   */
  private static extractTopics(text: string): string[] {
    const volleyballTopics = [
      'przepisy', 'regulamin', 'zasady', 'gra', 'mecz', 'turniej',
      'atak', 'blok', 'zagrywka', 'przyjęcie', 'obrona', 'ustawienia',
      'siatkówka', 'volleyball', 'piłka', 'siatka', 'boisko',
      'sędzia', 'sędziowanie', 'decyzje', 'faule', 'błędy',
      'technika', 'taktyka', 'trening', 'ćwiczenia', 'rozwój',
      'młodzież', 'juniorzy', 'seniorzy', 'kategoria', 'wiekowa',
      'federacja', 'fivb', 'pzps', 'klub', 'drużyna', 'zawodnik'
    ];

    const topics: string[] = [];
    const lowerText = text.toLowerCase();

    for (const topic of volleyballTopics) {
      if (lowerText.includes(topic)) {
        topics.push(topic);
      }
    }

    // Remove duplicates and return
    return Array.from(new Set(topics));
  }
}
