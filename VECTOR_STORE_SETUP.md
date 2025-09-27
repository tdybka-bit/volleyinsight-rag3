# Vector Store Setup - VolleyInsight

## 🚀 Instalacja i konfiguracja

### 1. Zainstaluj ChromaDB

```bash
# Używając Docker (zalecane)
docker run -p 8000:8000 chromadb/chroma

# Lub zainstaluj lokalnie
pip install chromadb
chroma run --host localhost --port 8000
```

### 2. Skonfiguruj zmienne środowiskowe

Utwórz plik `.env.local`:

```env
OPENAI_API_KEY=your-openai-api-key-here
CHROMA_HOST=localhost
CHROMA_PORT=8000
VECTOR_COLLECTION_NAME=volleyball-insights
EMBEDDING_MODEL=text-embedding-3-small
CONTENT_DIR=./content
DEFAULT_CHUNK_SIZE=500
DEFAULT_OVERLAP=100
```

### 3. Uruchom test

```bash
node test-vector-store.js
```

## 📁 Struktura plików

```
lib/
├── vectorStore.ts          # Główne funkcje ChromaDB
├── vectorIntegration.ts    # Integracja z markdown loader
├── markdownLoader.ts       # Ładowanie plików markdown
└── README.md              # Dokumentacja markdown loader

app/api/vector/
└── route.ts               # API endpoint dla vector store

content/                   # Pliki markdown
├── atak.md
├── blok.md
└── przepisy.md
```

## 🔧 Funkcje

### `initChromaDB()`
Inicjalizuje kolekcję 'volleyball-insights' w ChromaDB

### `embedAndStore(chunks)`
Zapisuje chunks jako embeddings używając OpenAI text-embedding-3-small

### `searchSimilar(query, limit=3)`
Wyszukuje podobne treści na podstawie zapytania

### `searchByType(type, limit=5)`
Wyszukuje treści według typu (blok, atak, przepisy, etc.)

## 🌐 API Endpoints

### GET `/api/vector?action=status`
Sprawdza status systemu

### GET `/api/vector?action=stats`
Pobiera statystyki bazy danych

### GET `/api/vector?action=search&query=atak&limit=3`
Wyszukuje podobne treści

### GET `/api/vector?action=by-type&type=blok&limit=5`
Wyszukuje treści według typu

### POST `/api/vector`
```json
{
  "action": "load-and-store",
  "contentDir": "./content",
  "chunkSize": 500,
  "overlap": 100
}
```

## 📊 Przykład użycia

```javascript
import { loadAndStoreContent, searchContent } from '@/lib/vectorIntegration';

// Załaduj i zapisz treści
const result = await loadAndStoreContent('./content', 500, 100);

// Wyszukaj podobne treści
const results = await searchContent('technika ataku', 3);

// Wyszukaj według typu
const attackContent = await getContentByType('atak', 5);
```

## 🧪 Testowanie

1. Uruchom ChromaDB: `docker run -p 8000:8000 chromadb/chroma`
2. Ustaw OPENAI_API_KEY w zmiennych środowiskowych
3. Uruchom test: `node test-vector-store.js`

## 🔍 Wyszukiwanie semantyczne

System używa embeddings OpenAI do wyszukiwania semantycznego:

- **Podobne treści**: Znajduje treści podobne znaczeniowo do zapytania
- **Wyszukiwanie według typu**: Filtruje treści według kategorii
- **Ranking**: Sortuje wyniki według podobieństwa (0-1)

## 📈 Statystyki

System śledzi:
- Liczbę chunków w bazie
- Rozkład typów treści
- Metadane każdego chunka
- Podobieństwo wyników wyszukiwania

## 🚨 Rozwiązywanie problemów

### ChromaDB nie działa
```bash
# Sprawdź czy port 8000 jest wolny
netstat -an | findstr :8000

# Uruchom ChromaDB
docker run -p 8000:8000 chromadb/chroma
```

### Błąd OpenAI API
- Sprawdź czy OPENAI_API_KEY jest ustawiony
- Sprawdź czy masz dostęp do API OpenAI
- Sprawdź limity API

### Błąd ładowania plików
- Sprawdź czy katalog `./content` istnieje
- Sprawdź czy pliki .md są w katalogu
- Sprawdź uprawnienia do odczytu plików

## 🎯 Następne kroki

1. Zintegruj z interfejsem użytkownika
2. Dodaj cache dla często wyszukiwanych treści
3. Implementuj feedback loop dla lepszych wyników
4. Dodaj metryki wydajności
5. Rozszerz o więcej typów treści
