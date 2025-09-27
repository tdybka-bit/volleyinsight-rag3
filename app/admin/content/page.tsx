'use client'

import { useState, useEffect } from 'react'
import AdminProtectedRoute from '../../../components/AdminProtectedRoute'
import DocxUploader from '../../../components/DocxUploader'
import { 
  FileText, 
  Upload, 
  Database, 
  Trash2, 
  Eye, 
  Download,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react'

interface ContentFile {
  filename: string
  size: number
  lastModified: string
  type: string
  wordCount: number
}

export default function ContentManagement() {
  const [contentFiles, setContentFiles] = useState<ContentFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    loadContentFiles()
  }, [])

  const loadContentFiles = async () => {
    setIsLoading(true)
    try {
      // In a real implementation, this would fetch from an API
      // For now, we'll simulate loading content files
      const mockFiles: ContentFile[] = [
        {
          filename: 'blok.md',
          size: 15420,
          lastModified: '2025-09-28T10:30:00Z',
          type: 'blok',
          wordCount: 1250
        },
        {
          filename: 'atak.md',
          size: 18750,
          lastModified: '2025-09-28T09:15:00Z',
          type: 'atak',
          wordCount: 1580
        },
        {
          filename: 'obrona.md',
          size: 12300,
          lastModified: '2025-09-28T08:45:00Z',
          type: 'obrona',
          wordCount: 980
        },
        {
          filename: 'zagrywka.md',
          size: 14200,
          lastModified: '2025-09-28T07:20:00Z',
          type: 'zagrywka',
          wordCount: 1150
        },
        {
          filename: 'ustawienia.md',
          size: 9800,
          lastModified: '2025-09-28T06:30:00Z',
          type: 'ustawienia',
          wordCount: 750
        },
        {
          filename: 'przepisy.md',
          size: 22100,
          lastModified: '2025-09-28T05:10:00Z',
          type: 'przepisy',
          wordCount: 1850
        }
      ]
      
      setContentFiles(mockFiles)
    } catch (error) {
      console.error('Error loading content files:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredFiles = contentFiles.filter(file => {
    const matchesSearch = file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         file.type.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterType === 'all' || file.type === filterType
    return matchesSearch && matchesFilter
  })

  const getTypeColor = (type: string) => {
    const colors = {
      'blok': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'atak': 'bg-red-500/20 text-red-400 border-red-500/30',
      'obrona': 'bg-green-500/20 text-green-400 border-green-500/30',
      'zagrywka': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'ustawienia': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'przepisy': 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pl-PL')
  }

  return (
    <AdminProtectedRoute>
      <div className="min-h-screen" style={{ background: 'var(--background)' }}>
        {/* Header */}
        <header className="glass border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
                     style={{ 
                       background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end), var(--gradient-accent))` 
                     }}>
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Zarządzanie treścią</h1>
                  <p className="text-sm text-muted-foreground">Upload i zarządzanie plikami DOCX</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={loadContentFiles}
                  className="px-3 py-2 admin-button-secondary rounded-lg"
                  title="Odśwież listę"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <a
                  href="/admin/dashboard"
                  className="px-3 py-2 glass rounded-lg hover:bg-white/10 transition-colors"
                  title="Powrót do dashboard"
                >
                  <Database className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Upload Section */}
            <div className="lg:col-span-1">
              <DocxUploader />
            </div>

            {/* Content Files List */}
            <div className="lg:col-span-2">
              <div className="admin-card rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-card-foreground">Pliki treści</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      {filteredFiles.length} z {contentFiles.length} plików
                    </span>
                  </div>
                </div>

                {/* Search and Filter */}
                <div className="flex space-x-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Szukaj plików..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 glass rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                    />
                  </div>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 glass rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  >
                    <option value="all">Wszystkie typy</option>
                    <option value="blok">Blok</option>
                    <option value="atak">Atak</option>
                    <option value="obrona">Obrona</option>
                    <option value="zagrywka">Zagrywka</option>
                    <option value="ustawienia">Ustawienia</option>
                    <option value="przepisy">Przepisy</option>
                  </select>
                </div>

                {/* Files List */}
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Ładowanie plików...</p>
                  </div>
                ) : filteredFiles.length > 0 ? (
                  <div className="space-y-3">
                    {filteredFiles.map((file, index) => (
                      <div key={index} className="p-4 glass rounded-lg hover:bg-white/5 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <h4 className="font-medium text-card-foreground">{file.filename}</h4>
                              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                <span>{formatFileSize(file.size)}</span>
                                <span>{file.wordCount} słów</span>
                                <span>{formatDate(file.lastModified)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 text-xs rounded-full border ${getTypeColor(file.type)}`}>
                              {file.type}
                            </span>
                            
                            <button
                              className="p-2 admin-button-secondary rounded-lg text-white hover:opacity-80 transition-opacity"
                              title="Podgląd"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            
                            <button
                              className="p-2 admin-button rounded-lg text-white hover:opacity-80 transition-opacity"
                              title="Pobierz"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            
                            <button
                              className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                              title="Usuń"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {searchTerm || filterType !== 'all' 
                        ? 'Nie znaleziono plików spełniających kryteria' 
                        : 'Brak plików treści'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminProtectedRoute>
  )
}
