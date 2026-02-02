# EdVolley - Changelog

## [2026-02-02] - RAG Knowledge Base + UTF-8 Fix

### ✅ Added
- RAG-based naming rules (removed hardcoded declensions)
- Google Drive sync for MD, DOCX, PDF, TXT files
- Player profiles in Pinecone (5 players)
- Naming rules namespace (Polish declension rules)
- Commentary phrases namespace

### 🔧 Fixed
- UTF-8 encoding (emoji + special chars work perfectly)
- Sync script embedding dimensions (768 to match Pinecone)
- Windows temp path for DOCX parsing
- Tag colors with dark mode support
- Foreign names now properly declined (e.g., Tavares Rodrigues → Tavaresa Rodriguesa)

### 📊 Statistics
- Files synced: 10
- Chunks uploaded: 16
- Namespaces populated: 3

---

## [2026-01-25] - Multi-match Support

### ✅ Added
- Dynamic team detection (ZAW/LBN, PGE/IND, JSW/ASS)
- Match selection dropdown (3 matches)

### 🔧 Fixed
- DataVolley JSON parser
- Multi-match compatibility