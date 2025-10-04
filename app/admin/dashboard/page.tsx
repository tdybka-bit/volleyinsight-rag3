'use client'

import { useState, useEffect } from 'react'
import AdminProtectedRoute from '../../../components/AdminProtectedRoute'
import { useAdminAuth } from '../../../components/AdminAuthProvider'
import { analytics } from '../../../lib/analytics'
import { 
  BarChart3, 
  Users, 
  MessageCircle, 
  Clock, 
  TrendingUp, 
  Download,
  Upload,
  Settings,
  LogOut,
  Home,
  FileText,
  Database,
  FolderOpen,
  RefreshCw,
  HardDrive,
  File,
  Calendar,
  Trash2,
  AlertTriangle
} from 'lucide-react'

export default function AdminDashboard() {
  const { logout } = useAdminAuth()
  const [stats, setStats] = useState({
    blockClicks: [],
    topQuestions: [],
    sessionStats: { totalSessions: 0, activeSessions: 0, completedSessions: 0, averageSessionTime: 0, totalEvents: 0 },
    pageStats: []
  })
  const [dbStats, setDbStats] = useState({
    general: { totalChunks: 0, totalFiles: 0, lastUpload: null, databaseSize: '0 KB' },
    breakdown: { byType: {}, byFile: [], totalSize: '0 KB' },
    recentUploads: [],
    files: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDb, setIsLoadingDb] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')
  const [isClearing, setIsClearing] = useState(false)
  const [clearResult, setClearResult] = useState<{success: boolean, message: string, deletedCount?: number} | null>(null)

  useEffect(() => {
    loadAnalytics()
    loadDbStats()
  }, [])

  const loadAnalytics = () => {
    setIsLoading(true)
    
    // Simulate loading delay
    setTimeout(() => {
      const blockClicks = analytics.getBlockClickStats()
      const topQuestions = analytics.getTopQuestions(10)
      const sessionStats = analytics.getSessionStats()
      const pageStats = analytics.getPageStats()
      
      setStats({
        blockClicks,
        topQuestions,
        sessionStats,
        pageStats
      })
      setIsLoading(false)
    }, 1000)
  }

  const loadDbStats = async () => {
    setIsLoadingDb(true)
    try {
      const response = await fetch('/api/admin/stats')
      const data = await response.json()
      
      if (data.success) {
        setDbStats(data)
        console.log('📊 Database stats loaded:', data)
      } else {
        console.error('❌ Error loading DB stats:', data.error)
      }
    } catch (error) {
      console.error('❌ Error fetching DB stats:', error)
    } finally {
      setIsLoadingDb(false)
    }
  }

  const handleLogout = () => {
    logout()
  }

  const handleClearDatabase = () => {
    setShowClearConfirm(true)
    setClearConfirmText('')
    setClearResult(null)
  }

  const confirmClearDatabase = async () => {
    if (clearConfirmText !== 'DELETE') {
      setClearResult({
        success: false,
        message: 'Musisz wpisać "DELETE" aby potwierdzić operację'
      })
      return
    }

    setIsClearing(true)
    setClearResult(null)

    try {
      const response = await fetch('/api/admin/clear-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (data.success) {
        // Show success message with count
        setClearResult({
          success: true,
          message: `Usunięto ${data.previousCount} chunków`,
          deletedCount: data.previousCount
        })
        
        // Auto-refresh stats after clearing
        await loadDbStats()
        
        // Close modal after 2 seconds
        setTimeout(() => {
          setShowClearConfirm(false)
          setClearConfirmText('')
          setClearResult(null)
        }, 2000)
      } else {
        setClearResult({
          success: false,
          message: data.message || 'Błąd podczas czyszczenia bazy danych'
        })
      }
    } catch (error) {
      setClearResult({
        success: false,
        message: 'Błąd połączenia z serwerem'
      })
    } finally {
      setIsClearing(false)
    }
  }

  const cancelClearDatabase = () => {
    setShowClearConfirm(false)
    setClearConfirmText('')
    setClearResult(null)
  }

  const exportData = () => {
    const data = analytics.exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `volleyinsight-analytics-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportCSV = () => {
    const { blockClicks, topQuestions } = stats
    
    // Block clicks CSV
    const blockClicksCSV = [
      ['Block ID', 'Block Name', 'Click Count'],
      ...blockClicks.map(block => [block.blockId, block.blockName, block.clickCount])
    ].map(row => row.join(',')).join('\n')
    
    const blob = new Blob([blockClicksCSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `volleyinsight-block-clicks-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <AdminProtectedRoute>
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
          <div className="glass-card rounded-xl p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Ładowanie danych...</p>
          </div>
        </div>
      </AdminProtectedRoute>
    )
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
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
                  <p className="text-sm text-muted-foreground">VolleyInsight Analytics</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <a
                  href="/admin/content"
                  className="px-3 py-2 glass rounded-lg hover:bg-white/10 transition-colors"
                  title="Zarządzanie treścią"
                >
                  <FolderOpen className="w-4 h-4" />
                </a>
                <a
                  href="/admin/debug"
                  className="px-3 py-2 glass rounded-lg hover:bg-white/10 transition-colors"
                  title="Debug Panel"
                >
                  <Database className="w-4 h-4" />
                </a>
                <button
                  onClick={loadAnalytics}
                  className="px-3 py-2 glass rounded-lg hover:bg-white/10 transition-colors"
                  title="Odśwież dane"
                >
                  <TrendingUp className="w-4 h-4" />
                </button>
                <button
                  onClick={loadDbStats}
                  disabled={isLoadingDb}
                  className="px-3 py-2 glass rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                  title="Odśwież statystyki bazy danych"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingDb ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleClearDatabase}
                  disabled={isClearing}
                  className="px-3 py-2 glass rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  title="Wyczyść bazę danych"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <a
                  href="/"
                  className="px-3 py-2 glass rounded-lg hover:bg-white/10 transition-colors"
                  title="Strona główna"
                >
                  <Home className="w-4 h-4" />
                </a>
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
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="admin-card rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sesje</p>
                  <p className="text-2xl font-bold text-foreground">{stats.sessionStats.totalSessions}</p>
                </div>
                <Users className="w-8 h-8 text-primary" />
              </div>
            </div>

            <div className="admin-card rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aktywne sesje</p>
                  <p className="text-2xl font-bold text-foreground">{stats.sessionStats.activeSessions}</p>
                </div>
                <Clock className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="admin-card rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Wydarzenia</p>
                  <p className="text-2xl font-bold text-foreground">{stats.sessionStats.totalEvents}</p>
                </div>
                <MessageCircle className="w-8 h-8 text-primary" />
              </div>
            </div>

            <div className="admin-card rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Śr. czas sesji</p>
                  <p className="text-2xl font-bold text-foreground">
                    {Math.round(stats.sessionStats.averageSessionTime / 1000 / 60)}min
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Block Clicks */}
            <div className="admin-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-card-foreground">Kliknięcia bloków</h3>
                <button
                  onClick={exportCSV}
                  className="px-3 py-1 text-sm admin-button rounded-lg flex items-center space-x-1"
                >
                  <Download className="w-3 h-3" />
                  <span>CSV</span>
                </button>
              </div>
              
              <div className="space-y-3">
                {stats.blockClicks.length > 0 ? (
                  stats.blockClicks.map((block, index) => (
                    <div key={block.blockId} className="flex items-center justify-between p-3 glass rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                             style={{ 
                               background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end))` 
                             }}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-card-foreground">{block.blockName}</p>
                          <p className="text-xs text-muted-foreground">{block.blockId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{block.clickCount}</p>
                        <p className="text-xs text-muted-foreground">kliknięć</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">Brak danych o kliknięciach</p>
                )}
              </div>
            </div>

            {/* Top Questions */}
            <div className="admin-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-card-foreground">Top pytania</h3>
                <button
                  onClick={exportData}
                  className="px-3 py-1 text-sm admin-button-secondary rounded-lg flex items-center space-x-1"
                >
                  <Download className="w-3 h-3" />
                  <span>JSON</span>
                </button>
              </div>
              
              <div className="space-y-3">
                {stats.topQuestions.length > 0 ? (
                  stats.topQuestions.map((question, index) => (
                    <div key={index} className="p-3 glass rounded-lg">
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                             style={{ 
                               background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end))` 
                             }}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-card-foreground line-clamp-2">{question.question}</p>
                          {question.topic && (
                            <p className="text-xs text-muted-foreground mt-1">Temat: {question.topic}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-primary">{question.count}</p>
                          <p className="text-xs text-muted-foreground">razy</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">Brak danych o pytaniach</p>
                )}
              </div>
            </div>
          </div>

          {/* Page Stats */}
          <div className="mt-8">
            <div className="admin-card rounded-xl p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-6">Statystyki stron</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Strona</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Wyświetlenia</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Śr. czas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.pageStats.length > 0 ? (
                      stats.pageStats.map((page, index) => (
                        <tr key={index} className="border-b border-border/50">
                          <td className="py-3 px-4 text-sm text-card-foreground">{page.page}</td>
                          <td className="py-3 px-4 text-sm text-right text-primary font-medium">{page.views}</td>
                          <td className="py-3 px-4 text-sm text-right text-muted-foreground">
                            {Math.round(page.averageTime / 1000)}s
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-muted-foreground">
                          Brak danych o stronach
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Database Statistics */}
          <div className="mt-8">
            <div className="admin-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-card-foreground flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  Database Management
                </h3>
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-muted-foreground">
                    Current: {dbStats.general.totalChunks} chunks
                  </div>
                  <button
                    onClick={loadDbStats}
                    disabled={isLoadingDb}
                    className="px-3 py-1 text-sm admin-button rounded-lg flex items-center space-x-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingDb ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={handleClearDatabase}
                    disabled={isClearing}
                    className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center space-x-1 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear All Chunks</span>
                  </button>
                </div>
              </div>

              {isLoadingDb ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Ładowanie statystyk bazy danych...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* General Stats */}
                  <div>
                    <h4 className="text-md font-semibold text-card-foreground mb-4 flex items-center">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Ogólne statystyki
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="glass rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Chunki</p>
                            <p className="text-2xl font-bold text-primary">{dbStats.general.totalChunks}</p>
                          </div>
                          <HardDrive className="w-8 h-8 text-primary" />
                        </div>
                      </div>
                      <div className="glass rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Pliki</p>
                            <p className="text-2xl font-bold text-green-500">{dbStats.general.totalFiles}</p>
                          </div>
                          <File className="w-8 h-8 text-green-500" />
                        </div>
                      </div>
                      <div className="glass rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Rozmiar bazy</p>
                            <p className="text-2xl font-bold text-blue-500">{dbStats.general.databaseSize}</p>
                          </div>
                          <Database className="w-8 h-8 text-blue-500" />
                        </div>
                      </div>
                      <div className="glass rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Ostatni upload</p>
                            <p className="text-sm font-bold text-orange-500">
                              {dbStats.general.lastUpload ? 
                                new Date(dbStats.general.lastUpload).toLocaleDateString() : 
                                'Brak'
                              }
                            </p>
                          </div>
                          <Calendar className="w-8 h-8 text-orange-500" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Breakdown by Type */}
                  <div>
                    <h4 className="text-md font-semibold text-card-foreground mb-4">Breakdown by Type</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="glass rounded-lg p-4">
                        <h5 className="text-sm font-medium text-card-foreground mb-3">Chunki per kategoria</h5>
                        <div className="space-y-2">
                          {Object.entries(dbStats.breakdown.byType).map(([type, count]) => (
                            <div key={type} className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground capitalize">{type}</span>
                              <span className="text-sm font-bold text-primary">{count as number}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="glass rounded-lg p-4">
                        <h5 className="text-sm font-medium text-card-foreground mb-3">Pliki źródłowe</h5>
                        <div className="space-y-2">
                          {dbStats.breakdown.byFile.map((file, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground truncate">{file.filename}</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-primary">{file.chunks}</span>
                                <span className="text-xs text-muted-foreground ml-1">chunks</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Uploads */}
                  <div>
                    <h4 className="text-md font-semibold text-card-foreground mb-4">Recent Uploads</h4>
                    <div className="space-y-2">
                      {dbStats.recentUploads.length > 0 ? (
                        dbStats.recentUploads.map((upload, index) => (
                          <div key={index} className="glass rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <FileText className="w-4 h-4 text-primary" />
                                <div>
                                  <p className="text-sm font-medium text-card-foreground">{upload.filename}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(upload.uploadDate).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-primary">{upload.chunksCount} chunks</p>
                                <p className="text-xs text-muted-foreground">
                                  {upload.status === 'completed' ? '✅ Completed' : '⏳ Processing'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground py-4">Brak ostatnich uploadów</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clear Database Modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="glass-card rounded-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Clear All Chunks</h3>
                  <p className="text-sm text-muted-foreground">Usunięcie wszystkich chunków jest nieodwracalne</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">
                    ⚠️ Ta operacja usunie wszystkie chunki z bazy danych ChromaDB. 
                    Aby kontynuować, wpisz <strong>DELETE</strong> w polu poniżej.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Wpisz DELETE żeby potwierdzić:
                  </label>
                  <input
                    type="text"
                    value={clearConfirmText}
                    onChange={(e) => setClearConfirmText(e.target.value)}
                    placeholder="Wpisz DELETE"
                    className="w-full px-3 py-2 glass rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-card-foreground"
                    disabled={isClearing}
                  />
                </div>

                {clearResult && (
                  <div className={`p-3 rounded-lg ${
                    clearResult.success 
                      ? 'bg-green-500/10 border border-green-500/20' 
                      : 'bg-red-500/10 border border-red-500/20'
                  }`}>
                    <p className={`text-sm ${
                      clearResult.success ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {clearResult.message}
                      {clearResult.deletedCount !== undefined && (
                        <span className="block mt-1 font-medium">
                          Usunięto: {clearResult.deletedCount} chunków
                        </span>
                      )}
                    </p>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={cancelClearDatabase}
                    disabled={isClearing}
                    className="flex-1 py-2 px-4 glass rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmClearDatabase}
                    disabled={isClearing || clearConfirmText !== 'DELETE'}
                    className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    {isClearing ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Confirm Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminProtectedRoute>
  )
}
