# RAG System Guide - VolleyInsight

## 🚀 Przegląd systemu

VolleyInsight używa zaawansowanego systemu RAG (Retrieval-Augmented Generation) do dostarczania inteligentnych odpowiedzi na pytania dotyczące siatkówki.

## 🏗️ Architektura

```
Frontend (React) 
    ↓
API Endpoints (/api/chat, /api/upload)
    ↓
Vector Store (ChromaDB) + OpenAI Embeddings
    ↓
Content Processing (Markdown → Chunks)
```

## 📁 Struktura plików

```
app/api/
├── chat/route.ts          # Chat API z RAG
└── upload/route.ts        # Upload API

lib/
├── vectorStore.ts         # ChromaDB operations
├── vectorIntegration.ts   # RAG integration
└── markdownLoader.ts      # Content processing

content/                   # Markdown files
├── atak.md
├── blok.md
└── przepisy.md
```

## 🔧 Komponenty systemu

### 1. API Chat (`/api/chat`)

**POST** - Generuje odpowiedzi z kontekstem:
```json
{
  "message": "Jak poprawić technikę ataku?",
  "limit": 3
}
```

**Odpowiedź:**
```json
{
  "success": true,
  "message": "Odpowiedź AI...",
  "context": {
    "hasContext": true,
    "sourcesCount": 2,
    "sources": [...]
  }
}
```

### 2. API Upload (`/api/upload`)

**POST** - Przesyła i przetwarza pliki:
```javascript
const formData = new FormData();
formData.append('file', file);
formData.append('type', 'general');
```

**Odpowiedź:**
```json
{
  "success": true,
  "message": "Plik przetworzony",
  "data": {
    "filename": "atak.md",
    "chunksCount": 5,
    "totalChunks": 15
  }
}
```

### 3. Vector Store (ChromaDB)

- **Kolekcja:** `volleyball-insights`
- **Embeddings:** OpenAI `text-embedding-3-small`
- **Chunking:** 500 znaków z 100 znaków overlap
- **Metadane:** typ, plik, indeks chunka

## 🎯 Funkcjonalności

### Wyszukiwanie semantyczne
- Znajduje podobne treści na podstawie znaczenia
- Ranking według podobieństwa (0-1)
- Filtrowanie według typu treści

### Generowanie odpowiedzi
- Kontekst z bazy wiedzy
- Prompt engineering dla siatkówki
- Fallback na ogólną wiedzę

### Upload i przetwarzanie
- Obsługa plików .md
- Automatyczne chunking
- Dodawanie do vector store

## 🚀 Uruchomienie

### 1. Uruchom ChromaDB
```bash
npm run chromadb:start
# lub
docker run -p 8000:8000 chromadb/chroma
```

### 2. Ustaw zmienne środowiskowe
```bash
set OPENAI_API_KEY=your-openai-api-key-here
```

### 3. Uruchom aplikację
```bash
npm run dev
```

### 4. Przetestuj system
```bash
npm run test:rag
```

## 📊 Przykład użycia

### 1. Załaduj treści
```javascript
const result = await loadAndStoreContent('./content', 500, 100);
console.log(`Załadowano ${result.chunksLoaded} chunków`);
```

### 2. Wyszukaj podobne treści
```javascript
const results = await searchContent('technika ataku', 3);
results.forEach(result => {
  console.log(`${result.similarity}: ${result.content}`);
});
```

### 3. Wyślij pytanie do chat
```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Jak poprawić blok?' })
});

const data = await response.json();
console.log(data.message);
```

## 🔍 Debugowanie

### Sprawdź status systemu
```bash
# Status ChromaDB
curl http://localhost:8000/api/v1/heartbeat

# Status API
curl http://localhost:3001/api/chat
curl http://localhost:3001/api/upload
```

### Logi
- ChromaDB: `console.log` w vectorStore.js
- API: `console.log` w route.ts
- Frontend: Developer Tools

## 🛠️ Konfiguracja

### Zmienne środowiskowe
```env
OPENAI_API_KEY=your-key-here
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

### Parametry chunking
```javascript
const chunks = await loadMarkdownFiles('./content', 500, 100);
// 500 znaków per chunk, 100 znaków overlap
```

### Parametry wyszukiwania
```javascript
const results = await searchSimilar(query, 3);
// Maksymalnie 3 wyniki
```

## 📈 Metryki

### Statystyki bazy danych
```javascript
const stats = await getCollectionStats();
console.log({
  totalChunks: stats.totalChunks,
  typeDistribution: stats.typeDistribution
});
```

### Jakość odpowiedzi
- Kontekst z bazy wiedzy
- Liczba źródeł
- Podobieństwo wyników

## 🚨 Rozwiązywanie problemów

### ChromaDB nie działa
```bash
# Sprawdź czy port 8000 jest wolny
netstat -an | findstr :8000

# Uruchom ChromaDB
docker run -p 8000:8000 chromadb/chroma
```

### Błąd OpenAI API
- Sprawdź klucz API
- Sprawdź limity
- Sprawdź połączenie internetowe

### Brak wyników wyszukiwania
- Sprawdź czy treści są załadowane
- Sprawdź jakość zapytań
- Sprawdź metadane chunków

## 🎯 Następne kroki

1. **Optymalizacja promptów** - lepsze odpowiedzi AI
2. **Cache** - szybsze wyszukiwanie
3. **Feedback loop** - uczenie się z interakcji
4. **Metryki** - monitoring jakości
5. **Więcej typów plików** - PDF, DOCX, etc.

## 📚 Dokumentacja API

### Chat API
- **POST** `/api/chat` - Generuje odpowiedzi
- **GET** `/api/chat` - Status systemu

### Upload API  
- **POST** `/api/upload` - Przesyła pliki
- **GET** `/api/upload` - Status upload

### Vector API
- **GET** `/api/vector?action=search&query=...` - Wyszukiwanie
- **POST** `/api/vector` - Operacje na bazie

## 🏆 Najlepsze praktyki

1. **Jakość treści** - używaj dobrze sformatowanych plików .md
2. **Chunking** - optymalne rozmiary chunków (400-600 znaków)
3. **Metadane** - dodawaj znaczące typy i kategorie
4. **Testowanie** - regularnie testuj jakość odpowiedzi
5. **Monitoring** - śledź statystyki i błędy













