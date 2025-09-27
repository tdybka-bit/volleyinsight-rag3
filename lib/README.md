# Markdown Loader

A utility library for loading, chunking, and searching markdown files from a content directory.

## Features

- 📁 **Load markdown files** from any directory
- ✂️ **Smart chunking** with configurable size and overlap
- 🔍 **Search functionality** across content and metadata
- 📊 **Group by type** based on filename patterns
- 🧹 **Content cleaning** (removes markdown formatting for better chunking)
- ⚡ **TypeScript support** with full type definitions

## Installation

The library is already included in the project. No additional installation required.

## Usage

### Basic Usage

```typescript
import { loadMarkdownFiles } from '@/lib/markdownLoader';

// Load all markdown files with default settings
const chunks = await loadMarkdownFiles('./content');
console.log(`Loaded ${chunks.length} chunks`);
```

### Custom Chunk Settings

```typescript
// Custom chunk size and overlap
const chunks = await loadMarkdownFiles('./content', 300, 50);
```

### Group by Type

```typescript
import { loadMarkdownFilesByType } from '@/lib/markdownLoader';

const chunksByType = await loadMarkdownFilesByType('./content');
console.log('Types:', Object.keys(chunksByType));
// Output: ['atak', 'blok', 'przepisy', ...]
```

### Search Chunks

```typescript
import { searchChunks } from '@/lib/markdownLoader';

const allChunks = await loadMarkdownFiles('./content');
const searchResults = searchChunks(allChunks, 'atak');
console.log(`Found ${searchResults.length} chunks containing 'atak'`);
```

## API Reference

### `loadMarkdownFiles(contentDir, chunkSize, overlap)`

Loads all markdown files from a directory and chunks them.

**Parameters:**
- `contentDir` (string): Path to content directory (default: './content')
- `chunkSize` (number): Size of each chunk in characters (default: 500)
- `overlap` (number): Number of characters to overlap between chunks (default: 100)

**Returns:** `Promise<MarkdownChunk[]>`

### `loadMarkdownFilesByType(contentDir, chunkSize, overlap)`

Loads markdown files and groups chunks by type.

**Returns:** `Promise<{ [type: string]: MarkdownChunk[] }>`

### `searchChunks(chunks, query, searchInContent, searchInMetadata)`

Searches through chunks for specific content.

**Parameters:**
- `chunks` (MarkdownChunk[]): Array of chunks to search
- `query` (string): Search query
- `searchInContent` (boolean): Whether to search in content (default: true)
- `searchInMetadata` (boolean): Whether to search in metadata (default: true)

**Returns:** `MarkdownChunk[]`

## Data Structure

### MarkdownChunk

```typescript
interface MarkdownChunk {
  content: string;           // The actual text content
  filename: string;          // Original filename (e.g., "atak.md")
  chunkIndex: number;        // Index of this chunk within the file
  metadata: {
    type: string;            // Extracted type (e.g., "atak", "blok")
    originalFile: string;    // Filename without extension
  };
}
```

## Content Directory Structure

The library expects markdown files in the following structure:

```
content/
├── atak.md          # Attack techniques
├── blok.md          # Block techniques  
├── przepisy.md      # Rules and regulations
├── przyjecie.md     # Reception techniques
├── zagrywka.md      # Serving techniques
└── ...
```

## Type Detection

The library automatically detects content types based on filename patterns:

- `atak.md` → type: "atak"
- `blok.md` → type: "blok"
- `przepisy.md` → type: "przepisy"
- `przyjecie.md` → type: "przyjecie"
- `zagrywka.md` → type: "zagrywka"
- `ustawienia.md` → type: "ustawienia"
- `podstawy.md` → type: "podstawy"
- `technika.md` → type: "technika"
- `taktyka.md` → type: "taktyka"
- `trening.md` → type: "trening"
- Other files → type: "ogolne"

## Smart Chunking

The chunking algorithm:

1. **Sentence boundaries**: Tries to break at sentence endings (., ?, !)
2. **Word boundaries**: Falls back to word boundaries if no sentence break
3. **Overlap**: Maintains specified overlap between chunks
4. **Content cleaning**: Removes markdown formatting for better chunking

## API Endpoints

### GET `/api/load-content`

Query parameters:
- `action`: "all" | "by-type" | "search"
- `query`: Search query (for search action)
- `chunkSize`: Chunk size (default: 500)
- `overlap`: Overlap size (default: 100)

### POST `/api/load-content`

Request body:
```json
{
  "action": "search",
  "query": "atak",
  "chunkSize": 500,
  "overlap": 100
}
```

## Examples

### Load all content

```bash
curl "http://localhost:3000/api/load-content?action=all"
```

### Search for specific content

```bash
curl "http://localhost:3000/api/load-content?action=search&query=atak"
```

### Load with custom settings

```bash
curl "http://localhost:3000/api/load-content?chunkSize=300&overlap=50"
```

## Error Handling

The library includes comprehensive error handling:

- Missing content directory → Returns empty array with warning
- File read errors → Logs error and continues with other files
- Invalid parameters → Returns appropriate error responses

## Performance

- **Memory efficient**: Processes files one at a time
- **Configurable chunking**: Adjust chunk size based on your needs
- **Smart boundaries**: Reduces chunk fragmentation
- **TypeScript**: Full type safety and IntelliSense support

## Testing

Run the test script to verify functionality:

```bash
node test-markdown-loader.js
```

This will test all major functions and display sample output.
