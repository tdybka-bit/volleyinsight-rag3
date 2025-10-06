'use client'

import { useState, useEffect } from 'react'
import AdminProtectedRoute from '../../../components/AdminProtectedRoute'
import { useAdminAuth } from '../../../components/AdminAuthProvider'
import {
  Volleyball,
  LogOut,
  Home,
  Database,
  FileText,
  Search,
  RefreshCw,
  BarChart3,
  Map,
  Layers,
  Eye,
  Download,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import Link from 'next/link'

interface ContentData {
  contentExists: boolean
  totalFiles: number
  totalChunks: number
  files: string[]
  fileStats: any[]
  chunksByType: any
  summary: any
}

interface ChunksData {
  collectionName: string
  totalChunks: number
  typeDistribution: any[]
  typeExamples: any
  summary: any
}

interface SourcesData {
  testQueries: any
  specificQuery: any
  sourceMap: any[]
  summary: any
}

export default function AdminDebugPage() {
  const { logout } = useAdminAuth()
  const [contentData, setContentData] = useState<ContentData | null>(null)
  const [chunksData, setChunksData] = useState<ChunksData | null>(null)
  const [sourcesData, setSourcesData] = useState<SourcesData | null>(null)
  const [loading, setLoading] = useState({ content: false, chunks: false, sources: false })
  const [error, setError] = useState<string | null>(null)

  const handleLogout = () => {
    logout()
    window.location.href = '/admin'
  }

  const fetchContentData = async () => {
    setLoading(prev => ({ ...prev, content: true }))
    setError(null)
    try {
      const response = await fetch('/api/debug/content')
      const data = await response.json()
      if (data.success) {
        setContentData(data.data)
      } else {
        setError(data.error || 'Błąd pobierania danych treści')
      }
    } catch (error: any) {
      setError(error.message || 'Błąd sieci')
    } finally {
      setLoading(prev => ({ ...prev, content: false }))
    }
  }

  const fetchChunksData = async () => {
    setLoading(prev => ({ ...prev, chunks: true }))
    setError(null)
    try {
      const response = await fetch('/api/debug/chunks')
      const data = await response.json()
      if (data.success) {
        setChunksData(data.data)
      } else {
        setError(data.error || 'Błąd pobierania danych chunków')
      }
    } catch (error: any) {
      setError(error.message || 'Błąd sieci')
    } finally {
      setLoading(prev => ({ ...prev, chunks: false }))
    }
  }

  const fetchSourcesData = async () => {
    setLoading(prev => ({ ...prev, sources: true }))
    setError(null)
    try {
      const response = await fetch('/api/debug/sources')
      const data = await response.json()
      if (data.success) {
        setSourcesData(data.data)
      } else {
        setError(data.error || 'Błąd pobierania danych źródeł')
      }
    } catch (error: any) {
      setError(error.message || 'Błąd sieci')
    } finally {
      setLoading(prev => ({ ...prev, sources: false }))
    }
  }

  const fetchAllData = async () => {
    await Promise.all([
      fetchContentData(),
      fetchChunksData(),
      fetchSourcesData()
    ])
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  return (
    <AdminProtectedRoute>
      <div className="min-h-screen theme-transition" style={{ background: 'var(--background)' }}>
        <header className="sticky top-0 z-50 glass border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                     style={{ background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end), var(--gradient-accent))` }}>
                  <Database className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Debug Panel</h1>
                  <p className="text-sm text-muted-foreground">Mapa przepływu danych VolleyInsight</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={fetchAllData}
                  className="px-3 py-2 admin-button-secondary rounded-lg"
                  title="Odśwież wszystkie dane"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <Link
                  href="/admin/dashboard"
                  className="px-3 py-2 glass rounded-lg hover:bg-white/10 transition-colors"
                  title="Dashboard"
                >
                  <BarChart3 className="w-4 h-4" />
                </Link>
                <Link
                  href="/"
                  className="px-3 py-2 glass rounded-lg hover:bg-white/10 transition-colors"
                  title="Strona główna"
                >
                  <Home className="w-4 h-4" />
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 glass rounded-lg hover:bg-red-500/20 transition-colors"
                  title="Wyloguj"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-6 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-500">{error}</span>
            </div>
          )}

          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="admin-card rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pliki treści</p>
                  <p className="text-2xl font-bold text-foreground">
                    {contentData?.totalFiles || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {contentData?.totalChunks || 0} chunków
                  </p>
                </div>
                <FileText className="w-8 h-8 text-primary" />
              </div>
            </div>

            <div className="admin-card rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Chunki w bazie</p>
                  <p className="text-2xl font-bold text-foreground">
                    {chunksData?.totalChunks || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {chunksData?.typeDistribution?.length || 0} typów
                  </p>
                </div>
                <Database className="w-8 h-8 text-primary" />
              </div>
            </div>

            <div className="admin-card rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unikalne źródła</p>
                  <p className="text-2xl font-bold text-foreground">
                    {sourcesData?.sourceMap?.length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sourcesData?.summary?.queriesWithResults || 0} zapytań działa
                  </p>
                </div>
                <Search className="w-8 h-8 text-primary" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Content Files */}
            <div className="admin-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-card-foreground flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Pliki treści (/content/)
                </h3>
                <button
                  onClick={fetchContentData}
                  disabled={loading.content}
                  className="px-3 py-1 text-sm admin-button rounded-lg flex items-center space-x-1"
                >
                  {loading.content ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              </div>

              {contentData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Typy dostępne:</p>
                      <p className="font-medium">{contentData.summary.typesAvailable.join(', ')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Średnio chunków/plik:</p>
                      <p className="font-medium">{contentData.summary.averageChunksPerFile}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-card-foreground">Szczegóły plików:</h4>
                    {contentData.fileStats.map((file, index) => (
                      <div key={index} className="p-3 glass rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-card-foreground">{file.filename}</p>
                            <p className="text-sm text-muted-foreground">
                              {file.chunks} chunków • {file.lines} linii • typ: {file.type}
                            </p>
                          </div>
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Kliknij odśwież aby załadować dane</p>
                </div>
              )}
            </div>

            {/* ChromaDB Chunks */}
            <div className="admin-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-card-foreground flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  Chunki w ChromaDB
                </h3>
                <button
                  onClick={fetchChunksData}
                  disabled={loading.chunks}
                  className="px-3 py-1 text-sm admin-button-secondary rounded-lg flex items-center space-x-1"
                >
                  {loading.chunks ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              </div>

              {chunksData ? (
                <div className="space-y-4">
                  <div className="text-sm">
                    <p className="text-muted-foreground">Kolekcja:</p>
                    <p className="font-medium">{chunksData.collectionName}</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-card-foreground">Dystrybucja typów:</h4>
                    {chunksData.typeDistribution.map((type, index) => (
                      <div key={index} className="flex items-center justify-between p-2 glass rounded-lg">
                        <span className="font-medium text-card-foreground">{type.type}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${type.percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-muted-foreground w-8">{type.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Kliknij odśwież aby załadować dane</p>
                </div>
              )}
            </div>

            {/* Source Mapping */}
            <div className="lg:col-span-2 admin-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-card-foreground flex items-center">
                  <Map className="w-5 h-5 mr-2" />
                  Mapa źródeł odpowiedzi
                </h3>
                <button
                  onClick={fetchSourcesData}
                  disabled={loading.sources}
                  className="px-3 py-1 text-sm admin-button rounded-lg flex items-center space-x-1"
                >
                  {loading.sources ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              </div>

              {sourcesData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-card-foreground mb-3">Test zapytań:</h4>
                      <div className="space-y-2">
                        {Object.entries(sourcesData.testQueries).map(([query, data]: [string, any]) => (
                          <div key={query} className="p-3 glass rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-card-foreground">"{query}"</span>
                              <div className="flex items-center space-x-2">
                                {data.found > 0 ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className="text-sm text-muted-foreground">
                                  {data.found} wyników
                                </span>
                              </div>
                            </div>
                            {data.bestMatch && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Najlepszy: {data.bestMatch.type} ({data.bestMatch.similarity}%)
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-card-foreground mb-3">Mapa źródeł:</h4>
                      <div className="space-y-2">
                        {sourcesData.sourceMap.slice(0, 5).map((source: any, index: number) => (
                          <div key={index} className="p-3 glass rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-card-foreground">{source.filename}</p>
                                <p className="text-sm text-muted-foreground">
                                  {source.type} • {source.queries.length} zapytań
                                </p>
                              </div>
                              <span className="text-sm text-primary">
                                {Math.round(source.totalSimilarity / source.queries.length)}% avg
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Map className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Kliknij odśwież aby załadować dane</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminProtectedRoute>
  )
}







