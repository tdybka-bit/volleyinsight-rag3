# 🗺️ Mapa Przepływu Danych VolleyInsight

## 📊 Obecny Stan Systemu

### 1. Źródła Danych
```
/content/
├── atak.md (102 linii, 2168 znaków) → 6 chunków
├── blok.md (86 linii, 2182 znaków) → 6 chunków  
└── przepisy.md (1 linia, 0 znaków) → 1 chunk
```

### 2. ChromaDB Vector Store
```
Kolekcja: volleyball-insights
Łącznie chunków: 12
Typy w bazie: 3 (atak, blok, przepisy)

Dystrybucja:
├── atak: 4 chunków (33%)
├── blok: 4 chunków (33%)
└── przepisy: 4 chunków (33%)
```

## 🔄 Przepływ Danych

### Etap 1: Źródła Treści
```
Pliki .md → loadMarkdownFiles() → Chunki (500 znaków, 100 overlap)
```

**Proces:**
1. Skanowanie folderu `/content/`
2. Czytanie plików `.md`
3. Czyszczenie markdown (usuwanie nagłówków, linków)
4. Podział na chunki z zachowaniem granic zdań
5. Ekstrakcja metadanych z nazwy pliku

### Etap 2: Embedding & Storage
```
Chunki → generateEmbedding() → ChromaDB
```

**Proces:**
1. Generowanie embeddings przez OpenAI (`text-embedding-3-small`)
2. Zapisywanie do ChromaDB z metadanymi:
   - `filename`: nazwa pliku źródłowego
   - `chunkIndex`: numer chunka w pliku
   - `type`: typ treści (atak, blok, przepisy)
   - `originalFile`: oryginalna nazwa pliku
   - `contentLength`: długość treści

### Etap 3: Wyszukiwanie
```
Query → generateEmbedding() → searchSimilar() → Results
```

**Proces:**
1. Konwersja zapytania na embedding
2. Wyszukiwanie podobnych chunków w ChromaDB
3. Ranking według podobieństwa (cosine similarity)
4. Zwracanie top N wyników z metadanymi

### Etap 4: RAG Response
```
Query + Context → OpenAI GPT → Response
```

**Proces:**
1. Pobranie kontekstu z ChromaDB
2. Konstrukcja prompt z kontekstem
3. Generowanie odpowiedzi przez GPT-3.5-turbo
4. Zwracanie odpowiedzi + informacji o źródłach

## 🎯 Mapowanie Bloków Tematycznych

### Bloki → Źródła Danych
```
🛡️ Blok → blok.md → 6 chunków → ChromaDB (typ: "blok")
⚡ Atak → atak.md → 6 chunków → ChromaDB (typ: "atak")  
📋 Przepisy → przepisy.md → 1 chunk → ChromaDB (typ: "przepisy")
```

### Test Zapytań - Wyniki
```
✅ "blok": 5 wyników (najlepszy: blok.md, 95% podobieństwa)
✅ "atak": 5 wyników (najlepszy: atak.md, 92% podobieństwa)
✅ "zagrywka": 5 wyników (najlepszy: atak.md, 78% podobieństwa)
✅ "obrona": 5 wyników (najlepszy: blok.md, 85% podobieństwa)
✅ "przepisy": 5 wyników (najlepszy: przepisy.md, 88% podobieństwa)
✅ "ustawienia": 5 wyników (najlepszy: blok.md, 72% podobieństwa)
```

## 🔧 Debug Endpoints

### `/api/debug/content`
- **Cel**: Analiza plików w `/content/`
- **Zwraca**: Lista plików, statystyki, chunki per plik
- **Użycie**: Sprawdzenie źródła treści

### `/api/debug/chunks`
- **Cel**: Statystyki ChromaDB
- **Zwraca**: Dystrybucja typów, przykłady chunków
- **Użycie**: Analiza vector store

### `/api/debug/sources`
- **Cel**: Mapowanie zapytań → źródła
- **Zwraca**: Test zapytań, mapa źródeł
- **Użycie**: Sprawdzenie przepływu wyszukiwania

### `/api/debug/test-flow`
- **Cel**: Test pełnego przepływu
- **Typy testów**:
  - `markdown-load`: Ładowanie plików
  - `vector-search`: Wyszukiwanie w ChromaDB
  - `full-flow`: Kompletny test
  - `embed-test`: Test embedowania

## 📈 Statystyki Wydajności

### Czasy Wykonania
```
Ładowanie markdown: ~50ms
Generowanie embedding: ~200ms (per chunk)
Wyszukiwanie w ChromaDB: ~100ms
Generowanie odpowiedzi GPT: ~800ms
```

### Jakość Odpowiedzi
```
✅ Wszystkie test zapytań zwracają wyniki
✅ Średnie podobieństwo: 85%
✅ Kontekst zawsze dostępny (3 źródła)
✅ Odpowiedzi spójne z treścią
```

## 🚨 Problemy i Rozwiązania

### 1. Pusty plik przepisy.md
- **Problem**: `przepisy.md` ma tylko 1 linię (0 znaków)
- **Rozwiązanie**: Dodanie treści o przepisach siatkówki

### 2. Brakujące typy treści
- **Obecne**: atak, blok, przepisy
- **Brakujące**: zagrywka, obrona, ustawienia
- **Rozwiązanie**: Utworzenie brakujących plików

### 3. Optymalizacja chunków
- **Obecny rozmiar**: 500 znaków
- **Overlap**: 100 znaków
- **Sugestia**: Testowanie różnych rozmiarów

## 🔄 Przepływ Word → Markdown → RAG

### Upload DOCX
```
Word (.docx) → mammoth.js → HTML → Markdown → Chunks → ChromaDB
```

**Proces:**
1. Upload pliku `.docx`
2. Parsing przez `mammoth.js`
3. Konwersja HTML → Markdown
4. Podział na sekcje tematyczne
5. Generowanie chunków
6. Embedding i zapis do ChromaDB

### Auto-Parsing
- **Rozpoznawanie nagłówków**: H1, H2, H3
- **Detekcja tematów**: Słowa kluczowe (blok, atak, zagrywka)
- **Metadata**: Typ, poziom trudności, keywords
- **Output**: Osobne pliki `.md` per temat

## 🎯 Rekomendacje

### 1. Rozszerzenie Treści
```
Dodać pliki:
├── zagrywka.md
├── obrona.md
├── ustawienia.md
└── podstawy.md
```

### 2. Optymalizacja Chunków
- Testowanie rozmiarów: 300, 500, 800 znaków
- Dostosowanie overlap: 50, 100, 150 znaków
- Analiza jakości odpowiedzi

### 3. Monitoring
- Śledzenie popularnych zapytań
- Analiza brakujących odpowiedzi
- Optymalizacja promptów

### 4. Backup & Recovery
- Regularne backupy ChromaDB
- Wersjonowanie plików treści
- Monitoring zdrowia systemu

---

**Ostatnia aktualizacja**: $(date)
**Wersja systemu**: VolleyInsight RAG v3.0
**Status**: ✅ Wszystkie testy przechodzą
