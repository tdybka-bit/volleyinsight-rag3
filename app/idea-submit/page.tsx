'use client';

import { useState } from 'react';

export default function IdeaSubmitPage() {
  const [idea, setIdea] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/submit-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, priority })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit idea');
      }

      setResult(data);
      setIdea(''); // Clear form
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            💡 VolleyInsight Ideas
          </h1>
          <p className="text-gray-600">
            Masz pomysł na ulepszenie? Wpisz poniżej - AI automatycznie go sklasyfikuje!
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Idea Input */}
            <div>
              <label htmlFor="idea" className="block text-sm font-semibold text-gray-700 mb-2">
                Twój pomysł / feedback / bug report:
              </label>
              <textarea
                id="idea"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Np: 'Chcę tracking bloków per set dla każdego zawodnika' lub 'Komentarz powinien wspomnieć o serii punktów' lub 'Demo mode pokazuje zły numer seta'"
                rows={6}
                required
                disabled={submitting}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors resize-none text-gray-800 disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Pisz naturalnie - AI rozpozna czy to commentary, feature, bug czy UI improvement
              </p>
            </div>

            {/* Priority Dropdown */}
            <div>
              <label htmlFor="priority" className="block text-sm font-semibold text-gray-700 mb-2">
                Priorytet:
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={submitting}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors text-gray-800 disabled:bg-gray-50"
              >
                <option value="high">🔥 High - Pilne</option>
                <option value="medium">⚡ Medium - Ważne</option>
                <option value="low">💡 Low - Nice to have</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !idea.trim()}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Przetwarzam...
                </span>
              ) : (
                'Wyślij pomysł 🚀'
              )}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <p className="text-red-700 font-semibold">❌ Błąd:</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div className="mt-6 p-6 bg-green-50 border-2 border-green-200 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <p className="text-green-800 font-bold text-lg">Pomysł zapisany!</p>
              </div>

              <div className="space-y-2 bg-white p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">ID:</span>
                  <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{result.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Typ:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    result.classification?.type === 'commentary_training' ? 'bg-purple-100 text-purple-700' :
                    result.classification?.type === 'feature_request' ? 'bg-blue-100 text-blue-700' :
                    result.classification?.type === 'bug_fix' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {result.classification?.type === 'commentary_training' ? '💬 Commentary Training' :
                     result.classification?.type === 'feature_request' ? '✨ Feature Request' :
                     result.classification?.type === 'bug_fix' ? '🐛 Bug Fix' :
                     '🎨 UI/UX Improvement'}
                  </span>
                </div>
                {result.classification?.title && (
                  <div>
                    <span className="font-semibold text-gray-700">Tytuł:</span>
                    <p className="text-gray-600 mt-1">{result.classification.title}</p>
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-600">
                Pomysł został zapisany i jest gotowy do review! 🎉
              </p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
          <h3 className="font-bold text-blue-900 mb-2">💡 Jak to działa?</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✅ Wpisujesz pomysł naturalnym językiem</li>
            <li>✅ AI automatycznie klasyfikuje (Commentary/Feature/Bug/UI)</li>
            <li>✅ Zapisuje do bazy z unikalnym ID</li>
            <li>✅ Gotowe do review i implementacji!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
