'use client'

import { useState } from 'react'
import { 
  CheckCircle, 
  XCircle, 
  Edit3, 
  Filter, 
  Settings, 
  AlertTriangle,
  BarChart3,
  Save,
  ArrowLeft
} from 'lucide-react'

interface AnalysisResult {
  text: string;
  suggestedCategory: string;
  confidence: number;
  index: number;
}

interface CategorizationPreviewProps {
  analysisResults: {
    filename: string;
    totalParagraphs: number;
    analyzedParagraphs: number;
    results: AnalysisResult[];
    statistics: {
      categoryStats: Record<string, number>;
      averageConfidence: number;
      lowConfidenceCount: number;
    };
    processingTime: number;
  };
  onApprove: (results: AnalysisResult[]) => void;
  onCancel: () => void;
}

const CATEGORIES = ['blok', 'atak', 'obrona', 'zagrywka', 'ustawienia', 'przepisy', 'ogólne'];
const CATEGORY_LABELS = {
  'blok': '🛡️ Blok',
  'atak': '⚡ Atak', 
  'obrona': '🏐 Obrona',
  'zagrywka': '🎯 Zagrywka',
  'ustawienia': '⚙️ Ustawienia',
  'przepisy': '📋 Przepisy',
  'ogólne': '📖 Ogólne'
};

export default function CategorizationPreview({ 
  analysisResults, 
  onApprove, 
  onCancel 
}: CategorizationPreviewProps) {
  const [results, setResults] = useState<AnalysisResult[]>(analysisResults.results);
  const [showLowConfidenceOnly, setShowLowConfidenceOnly] = useState(false);
  const [batchCategory, setBatchCategory] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const updateCategory = (index: number, newCategory: string) => {
    setResults(prev => prev.map(result => 
      result.index === index 
        ? { ...result, suggestedCategory: newCategory }
        : result
    ));
  };

  const handleBatchUpdate = () => {
    if (!batchCategory) return;
    
    const updatedResults = results.map(result => {
      if (result.suggestedCategory === 'ogólne') {
        return { ...result, suggestedCategory: batchCategory };
      }
      return result;
    });
    
    setResults(updatedResults);
    setBatchCategory('');
  };

  const toggleRowSelection = (index: number) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedRows(newSelection);
  };

  const updateSelectedCategories = (newCategory: string) => {
    const updatedResults = results.map(result => {
      if (selectedRows.has(result.index)) {
        return { ...result, suggestedCategory: newCategory };
      }
      return result;
    });
    setResults(updatedResults);
    setSelectedRows(new Set());
  };

  const filteredResults = showLowConfidenceOnly 
    ? results.filter(result => result.confidence < 0.6)
    : results;

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle className="w-4 h-4" />;
    if (confidence >= 0.6) return <AlertTriangle className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Categorization Preview</h2>
          <p className="text-muted-foreground">
            {analysisResults.filename} • {analysisResults.analyzedParagraphs} paragrafów
          </p>
        </div>
        <button
          onClick={onCancel}
          className="flex items-center space-x-2 px-4 py-2 glass rounded-lg hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Upload</span>
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Average Confidence</p>
              <p className="text-lg font-bold text-foreground">
                {(analysisResults.statistics.averageConfidence * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
        
        <div className="glass-card rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="text-sm text-muted-foreground">Low Confidence</p>
              <p className="text-lg font-bold text-foreground">
                {analysisResults.statistics.lowConfidenceCount}
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Categories</p>
              <p className="text-lg font-bold text-foreground">
                {Object.keys(analysisResults.statistics.categoryStats).length}
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Processing Time</p>
              <p className="text-lg font-bold text-foreground">
                {(analysisResults.processingTime / 1000).toFixed(1)}s
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between glass-card rounded-lg p-4">
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showLowConfidenceOnly}
              onChange={(e) => setShowLowConfidenceOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-foreground">Show only low confidence (&lt;60%)</span>
          </label>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-sm text-muted-foreground">Batch update "ogólne":</span>
          <select
            value={batchCategory}
            onChange={(e) => setBatchCategory(e.target.value)}
            className="px-3 py-1 glass rounded-lg text-sm"
          >
            <option value="">Select category</option>
            {CATEGORIES.filter(cat => cat !== 'ogólne').map(category => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
              </option>
            ))}
          </select>
          <button
            onClick={handleBatchUpdate}
            disabled={!batchCategory}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Update All
          </button>
        </div>
      </div>

      {/* Selected rows actions */}
      {selectedRows.size > 0 && (
        <div className="glass-card rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">
              {selectedRows.size} rows selected
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Change to:</span>
              <select
                onChange={(e) => updateSelectedCategories(e.target.value)}
                className="px-3 py-1 glass rounded-lg text-sm"
                defaultValue=""
              >
                <option value="">Select category</option>
                {CATEGORIES.map(category => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground w-8">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows(new Set(filteredResults.map(r => r.index)));
                      } else {
                        setSelectedRows(new Set());
                      }
                    }}
                    className="rounded"
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Fragment tekstu
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Kategoria
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Confidence
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result) => (
                <tr key={result.index} className="border-b border-border/50 hover:bg-white/5">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(result.index)}
                      onChange={() => toggleRowSelection(result.index)}
                      className="rounded"
                    />
                  </td>
                  <td className="py-3 px-4 max-w-md">
                    <p className="text-sm text-card-foreground line-clamp-3">
                      {result.text.substring(0, 100)}
                      {result.text.length > 100 && '...'}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={result.suggestedCategory}
                      onChange={(e) => updateCategory(result.index, e.target.value)}
                      className="px-2 py-1 glass rounded text-sm min-w-[120px]"
                    >
                      {CATEGORIES.map(category => (
                        <option key={category} value={category}>
                          {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(result.confidence)}`}>
                      {getConfidenceIcon(result.confidence)}
                      <span>{(result.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => {
                        // Toggle between categories
                        const currentIndex = CATEGORIES.indexOf(result.suggestedCategory);
                        const nextCategory = CATEGORIES[(currentIndex + 1) % CATEGORIES.length];
                        updateCategory(result.index, nextCategory);
                      }}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                      title="Quick cycle categories"
                    >
                      <Edit3 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between glass-card rounded-lg p-4">
        <div className="text-sm text-muted-foreground">
          Showing {filteredResults.length} of {results.length} results
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 glass rounded-lg hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onApprove(results)}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Approve & Process</span>
          </button>
        </div>
      </div>
    </div>
  );
}










