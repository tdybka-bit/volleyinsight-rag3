'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Download, Eye } from 'lucide-react'

interface UploadResult {
  success: boolean
  message: string
  data?: {
    originalFile: string
    parsedSections: number
    savedFiles: string[]
    topics: string[]
    totalWordCount: number
    ragProcessed: boolean
    chunksCount: number
  }
  error?: string
}

export default function DocxUploader() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [previewContent, setPreviewContent] = useState<{ [filename: string]: string } | null>(null)
  const [autoProcess, setAutoProcess] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.name.endsWith('.docx')) {
      handleUpload(file)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file && file.name.endsWith('.docx')) {
      handleUpload(file)
    }
  }

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    setUploadResult(null)
    setPreviewContent(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('autoProcess', autoProcess.toString())

      const response = await fetch('/api/admin/upload-docx', {
        method: 'POST',
        body: formData,
      })

      const result: UploadResult = await response.json()
      setUploadResult(result)

      if (result.success && result.data) {
        // Load preview content
        const preview: { [filename: string]: string } = {}
        for (const filename of result.data.savedFiles) {
          try {
            const response = await fetch(`/content/${filename}`)
            if (response.ok) {
              preview[filename] = await response.text()
            }
          } catch (error) {
            console.error(`Error loading preview for ${filename}:`, error)
          }
        }
        setPreviewContent(preview)
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadResult({
        success: false,
        message: 'Błąd podczas przesyłania pliku',
        error: error instanceof Error ? error.message : 'Nieznany błąd'
      })
    } finally {
      setIsUploading(false)
    }
  }

  const downloadMarkdown = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="admin-card rounded-xl p-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          Upload plików Word (.docx)
        </h3>

        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          
          {isUploading ? (
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
              <p className="text-muted-foreground">Przetwarzanie pliku...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
              <div>
                <p className="text-lg font-medium text-card-foreground">
                  Przeciągnij plik .docx tutaj lub kliknij aby wybrać
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Plik zostanie automatycznie podzielony na tematy i skonwertowany do markdown
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Auto-process option */}
        <div className="mt-4 flex items-center space-x-2">
          <input
            type="checkbox"
            id="autoProcess"
            checked={autoProcess}
            onChange={(e) => setAutoProcess(e.target.checked)}
            className="rounded border-border"
          />
          <label htmlFor="autoProcess" className="text-sm text-muted-foreground">
            Automatycznie dodaj do bazy wiedzy RAG po konwersji
          </label>
        </div>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className="admin-card rounded-xl p-6">
          <div className="flex items-start space-x-3">
            {uploadResult.success ? (
              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
            )}
            <div className="flex-1">
              <h4 className="font-semibold text-card-foreground mb-2">
                {uploadResult.success ? 'Sukces!' : 'Błąd'}
              </h4>
              <p className="text-muted-foreground mb-4">{uploadResult.message}</p>
              
              {uploadResult.success && uploadResult.data && (
                <div className="space-y-4">
                  {/* Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 glass rounded-lg">
                      <p className="text-2xl font-bold text-primary">{uploadResult.data.parsedSections}</p>
                      <p className="text-xs text-muted-foreground">Sekcje</p>
                    </div>
                    <div className="text-center p-3 glass rounded-lg">
                      <p className="text-2xl font-bold text-primary">{uploadResult.data.savedFiles.length}</p>
                      <p className="text-xs text-muted-foreground">Pliki .md</p>
                    </div>
                    <div className="text-center p-3 glass rounded-lg">
                      <p className="text-2xl font-bold text-primary">{uploadResult.data.totalWordCount}</p>
                      <p className="text-xs text-muted-foreground">Słowa</p>
                    </div>
                    <div className="text-center p-3 glass rounded-lg">
                      <p className="text-2xl font-bold text-primary">{uploadResult.data.chunksCount || 0}</p>
                      <p className="text-xs text-muted-foreground">Chunks RAG</p>
                    </div>
                  </div>

                  {/* Topics */}
                  <div>
                    <h5 className="font-medium text-card-foreground mb-2">Wykryte tematy:</h5>
                    <div className="flex flex-wrap gap-2">
                      {uploadResult.data.topics.map((topic, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 text-sm glass rounded-full text-primary"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Generated files */}
                  <div>
                    <h5 className="font-medium text-card-foreground mb-2">Wygenerowane pliki:</h5>
                    <div className="space-y-2">
                      {uploadResult.data.savedFiles.map((filename, index) => (
                        <div key={index} className="flex items-center justify-between p-2 glass rounded-lg">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-card-foreground">{filename}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                if (previewContent?.[filename]) {
                                  downloadMarkdown(filename, previewContent[filename])
                                }
                              }}
                              className="p-1 admin-button rounded text-white hover:opacity-80 transition-opacity"
                              title="Pobierz plik"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RAG Status */}
                  {uploadResult.data.ragProcessed && (
                    <div className="p-3 glass rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-400">
                          Plik został automatycznie dodany do bazy wiedzy RAG ({uploadResult.data.chunksCount} chunks)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Content */}
      {previewContent && (
        <div className="admin-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            Podgląd wygenerowanych plików
          </h3>
          
          <div className="space-y-4">
            {Object.entries(previewContent).map(([filename, content]) => (
              <div key={filename} className="border border-border rounded-lg">
                <div className="p-3 border-b border-border bg-muted/50">
                  <h4 className="font-medium text-card-foreground">{filename}</h4>
                </div>
                <div className="p-4 max-h-64 overflow-y-auto custom-scrollbar">
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {content.substring(0, 1000)}
                    {content.length > 1000 && '...'}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
